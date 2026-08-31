"""페르소나 챗봇 HTTP 서버 — 표준 라이브러리만 쓴다.

    python server.py                # 키가 있으면 실제 모델, 없으면 mock
    python server.py --mock         # 과금 없이 형태만 확인
    python server.py --port 8010

엔드포인트

    GET    /health
    GET    /meta                     데이터 기준일과 지원 페르소나
    GET    /companies?q=&limit=      종목 검색
    POST   /sessions                 {ticker, persona} -> 세션 생성 + 첫 해설
    POST   /sessions/{id}/messages   {question} -> 후속 답변
    POST   /sessions/{id}/persona    {persona} -> 관점 교체 + 새 첫 해설
    DELETE /sessions/{id}

이 파일은 대화 코어(chat.py)를 부르는 껍데기로만 남긴다. 판단은 전부 코어에 있고
여기에는 HTTP 사정(라우팅·검증·CORS·상태코드)만 둔다. 나중에 FastAPI 같은 것으로
갈아탄다면 이 파일만 버리면 된다.
"""
from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
import traceback
from collections import deque
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

import scores_source
from chat import PersonaChat
from explain import MockAdapter, OpenAIAdapter, load_dotenv_file
from personas import PERSONAS, is_checklist, persona_kind
from session_store import SessionNotFound, SessionStore

# 질문이 길어지면 프롬프트를 밀어내 앵커 뒤의 규칙이 흐려진다.
MAX_QUESTION_CHARS = 500
# 본문 상한. 이 API는 짧은 JSON만 받는다.
MAX_BODY_BYTES = 16 * 1024
MAX_SEARCH_LIMIT = 50

# 프로세스 전역 LLM 호출 상한(분당). IP 무관이라 X-Forwarded-For 스푸핑에 뚫리지
# 않는 비용 회로차단이다. per-IP·토큰 제한은 신뢰 가능한 엣지(Nginx/Next)에서
# 해야 정확하므로 여기 두지 않는다. 세션 보관소가 이미 프로세스 메모리인 것과 같은
# 단일 프로세스 가정을 따른다.
MAX_LLM_CALLS_PER_MINUTE = 60


class HttpError(Exception):
    """그대로 응답으로 바뀌는 오류."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


_RATE_LIMITED = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."


class RateLimiter:
    """프로세스 전역 슬라이딩 윈도우 호출 상한. 스레드 안전.

    allow()가 True면 호출 1건을 기록하고 통과시키고, 윈도우 안 호출 수가 상한을
    넘으면 False를 준다. RateLimitedAdapter가 실제 LLM 호출(adapter.chat)마다
    소비하므로, HTTP 요청 수가 아니라 진짜 호출 수를 센다.
    """

    def __init__(self, max_calls: int, window_seconds: float = 60.0):
        self.max_calls = max_calls
        self.window_seconds = window_seconds
        self._events: deque[float] = deque()
        self._lock = threading.Lock()

    def allow(self) -> bool:
        now = time.monotonic()
        with self._lock:
            cutoff = now - self.window_seconds
            while self._events and self._events[0] < cutoff:
                self._events.popleft()
            if len(self._events) >= self.max_calls:
                return False
            self._events.append(now)
            return True


class RateLimitedAdapter:
    """어댑터를 감싸 실제 LLM 호출(chat)마다 상한을 확인한다.

    상한을 HTTP 엔드포인트가 아니라 진짜 호출 지점에서 세야, ask()가 내부적으로
    start()를 한 번 더 부르거나 generate()가 안전 재생성으로 두 번 부르는 경우까지
    정확히 반영된다. 반대로 캐시된 응답처럼 실제 호출이 없는 경로는 예산을 깎지 않는다.
    상한을 넘으면 HttpError(429)를 던져 그대로 응답이 된다.
    """

    def __init__(self, inner, limiter: RateLimiter):
        self._inner = inner
        self._limiter = limiter

    def __getattr__(self, item):
        # name·model·base_url 등은 감싼 어댑터로 위임한다.
        return getattr(self._inner, item)

    def chat(self, system: str, messages: list[dict], temperature: float = 0.0) -> str:
        if not self._limiter.allow():
            raise HttpError(429, "rate_limited", _RATE_LIMITED)
        return self._inner.chat(system, messages, temperature)

    def complete(self, system: str, user: str) -> str:
        return self.chat(system, [{"role": "user", "content": user}])


@dataclass
class Conversation:
    """세션 하나. 시작 당시 데이터에 고정하고, 겹친 요청은 순서대로 처리한다.

    배치가 scores.json을 원자 교체해도 진행 중인 대화는 시작 당시 값으로 끝난다 —
    한 대화 안에서 기준일이 바뀌면 앞뒤 답이 어긋난다."""

    chat: PersonaChat
    lock: threading.Lock
    data: scores_source.ScoresData


# ---- 요청 검증 ---------------------------------------------------------------

def _require_object(body) -> dict:
    if not isinstance(body, dict):
        raise HttpError(400, "invalid_body", "본문은 JSON 객체여야 합니다.")
    return body


def _check_fields(body: dict, allowed: set[str]) -> None:
    """모르는 필드는 조용히 무시하지 않고 거부한다.

    필드 이름을 틀렸을 때 조용히 기본값으로 도는 것이 가장 찾기 어려운 버그다.
    """
    unknown = sorted(set(body) - allowed)
    if unknown:
        raise HttpError(400, "unknown_fields",
                        f"모르는 필드입니다: {unknown}. 쓸 수 있는 필드: {sorted(allowed)}")


def _text_field(body: dict, key: str, max_chars: int) -> str:
    value = body.get(key)
    if not isinstance(value, str):
        raise HttpError(400, "invalid_field", f"'{key}'는 문자열이어야 합니다.")
    value = value.strip()
    if not value:
        raise HttpError(400, "invalid_field", f"'{key}'가 비어 있습니다.")
    if len(value) > max_chars:
        raise HttpError(400, "too_long",
                        f"'{key}'는 {max_chars}자까지입니다. (받은 길이 {len(value)})")
    return value


# ---- 서버 -------------------------------------------------------------------

def build_adapter(force_mock: bool = False):
    """실제 어댑터를 만들어 보고, 키가 없거나 SDK가 없으면 mock으로 떨어진다."""
    if force_mock:
        return MockAdapter(), "mock 모드(강제)"
    try:
        adapter = OpenAIAdapter()
    except (RuntimeError, ImportError) as exc:
        return MockAdapter(), f"mock 모드({exc})"
    return adapter, f"model={adapter.model} base_url={adapter.base_url}"


def make_handler(adapter, store: SessionStore, data: scores_source.ScoresData,
                 allowed_origins: str):
    """공유 상태를 담은 핸들러 클래스를 만든다.

    BaseHTTPRequestHandler는 요청마다 새로 만들어지므로 상태를 클래스 쪽에 둔다.
    """

    def current_data() -> scores_source.ScoresData:
        # 배치가 파일을 교체하면 다음 요청부터 새 스냅샷이 잡힌다.
        return scores_source.get_data(data.path)

    class Handler(BaseHTTPRequestHandler):
        server_version = "PersonaChat/1.0"
        protocol_version = "HTTP/1.1"

        # -- 라우팅 --

        def do_OPTIONS(self):  # noqa: N802 (표준 라이브러리 규약)
            self.send_response(204)
            self._cors_headers()
            self.send_header("Access-Control-Allow-Methods",
                             "GET, POST, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self):  # noqa: N802
            self._dispatch("GET")

        def do_POST(self):  # noqa: N802
            self._dispatch("POST")

        def do_DELETE(self):  # noqa: N802
            self._dispatch("DELETE")

        def _dispatch(self, method: str) -> None:
            path = urlsplit(self.path).path.rstrip("/") or "/"
            try:
                if method == "GET" and path == "/":
                    self._send_html(_playground_html())
                    return
                for route_method, pattern, name in ROUTES:
                    match = pattern.match(path)
                    if not match:
                        continue
                    if route_method != method:
                        raise HttpError(405, "method_not_allowed",
                                        f"{path}에는 {method}를 쓸 수 없습니다.")
                    status, payload = getattr(self, name)(match)
                    self._send_json(status, payload)
                    return
                raise HttpError(404, "not_found", f"없는 주소입니다: {path}")
            except HttpError as exc:
                self._send_json(exc.status,
                                {"error": {"code": exc.code, "message": exc.message}})
            except Exception:  # 예상 못 한 오류도 JSON으로 돌려준다
                traceback.print_exc()
                self._send_json(500, {"error": {
                    "code": "internal_error",
                    "message": "서버에서 오류가 났습니다. 서버 로그를 확인하세요."}})

        # -- 엔드포인트 --

        def ep_health(self, _match):
            snapshot = current_data()
            return 200, {
                "status": "ok",
                "adapter": adapter.name,
                "model": getattr(adapter, "model", None),
                "sessions": len(store),
                "companies": len(snapshot),
                "generatedAt": snapshot.generated_at,
                "personas": _supported_personas(snapshot),
            }

        def ep_meta(self, _match):
            snapshot = current_data()
            meta = snapshot.meta()
            meta["personas"] = _supported_personas(snapshot)
            meta["sessionTtlSeconds"] = store.ttl_seconds
            meta["maxQuestionChars"] = MAX_QUESTION_CHARS
            return 200, meta

        def ep_companies(self, _match):
            snapshot = current_data()
            query = parse_qs(urlsplit(self.path).query)
            q = (query.get("q") or [""])[0]
            raw_limit = (query.get("limit") or ["10"])[0]
            try:
                limit = int(raw_limit)
            except ValueError:
                raise HttpError(400, "invalid_query",
                                "'limit'은 정수여야 합니다.") from None
            limit = max(1, min(limit, MAX_SEARCH_LIMIT))
            return 200, {"query": q, "results": snapshot.search(q, limit)}

        def ep_create_session(self, _match):
            snapshot = current_data()
            body = _require_object(self._read_json())
            _check_fields(body, {"ticker", "persona"})
            ticker = _text_field(body, "ticker", 16)
            persona = _text_field(body, "persona", 32)
            _check_persona(persona, snapshot)

            try:
                company = snapshot.company(ticker)
            except scores_source.UnknownTicker:
                raise HttpError(404, "unknown_ticker",
                                f"유니버스에 없는 종목입니다: {ticker}") from None

            if is_checklist(persona):
                # scores.json에 이 관점의 스타일이 없다. 판정을 찾으면 UnknownStyle이다.
                chat = PersonaChat(persona, company=company, adapter=adapter)
            else:
                chat = PersonaChat(
                    persona, company=company,
                    judgement=snapshot.judgement(company.ticker, persona),
                    criteria_spec=snapshot.styles[persona].criteria,
                    adapter=adapter,
                )
            reply = _run(chat.start)
            session_id = store.create(Conversation(chat, threading.Lock(), snapshot))
            payload = _session_payload(chat, reply)
            payload["sessionId"] = session_id
            payload["expiresIn"] = round(store.expires_in(session_id))
            return 201, payload

        def ep_message(self, match):
            conv, session_id = _lookup(store, match.group("sid"))
            body = _require_object(self._read_json())
            _check_fields(body, {"question"})
            question = _text_field(body, "question", MAX_QUESTION_CHARS)

            with conv.lock:
                reply = _run(conv.chat.ask, question)
            return 200, {
                "sessionId": session_id,
                "persona": conv.chat.persona_key,
                "personaName": conv.chat.persona_name,
                "reply": reply.text,
                "verdict": reply.verdict,
                "regenerated": reply.regenerated,
                "blocked": reply.blocked,
                "expiresIn": round(store.expires_in(session_id)),
            }

        def ep_switch_persona(self, match):
            conv, session_id = _lookup(store, match.group("sid"))
            body = _require_object(self._read_json())
            _check_fields(body, {"persona"})
            persona = _text_field(body, "persona", 32)
            _check_persona(persona, conv.data)

            with conv.lock:
                if persona != conv.chat.persona_key:
                    if is_checklist(persona):
                        conv.chat.switch_persona(persona)
                    else:
                        conv.chat.switch_persona(
                            persona,
                            judgement=conv.data.judgement(conv.chat.company.ticker, persona),
                            criteria_spec=conv.data.styles[persona].criteria,
                        )
                reply = _run(conv.chat.start)
            payload = _session_payload(conv.chat, reply)
            payload["sessionId"] = session_id
            payload["expiresIn"] = round(store.expires_in(session_id))
            return 200, payload

        def ep_delete_session(self, match):
            if not store.delete(match.group("sid")):
                raise HttpError(404, "session_not_found", _SESSION_GONE)
            return 200, {"deleted": True}

        # -- 입출력 --

        def _read_json(self):
            length = self.headers.get("Content-Length")
            if not length:
                raise HttpError(400, "missing_body", "본문이 없습니다.")
            try:
                size = int(length)
            except ValueError:
                raise HttpError(400, "invalid_length",
                                "Content-Length가 숫자가 아닙니다.") from None
            if size > MAX_BODY_BYTES:
                raise HttpError(413, "body_too_large",
                                f"본문은 {MAX_BODY_BYTES}바이트까지입니다.")
            raw = self.rfile.read(size)
            try:
                return json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise HttpError(400, "invalid_json",
                                f"JSON을 읽지 못했습니다: {exc}") from None

        def _cors_headers(self) -> None:
            origin = self.headers.get("Origin")
            if allowed_origins == "*":
                self.send_header("Access-Control-Allow-Origin", "*")
            elif origin and origin in allowed_origins.split(","):
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")

        def _send_json(self, status: int, payload: dict) -> None:
            raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self._send_bytes(status, raw, "application/json; charset=utf-8")

        def _send_html(self, html: str) -> None:
            self._send_bytes(200, html.encode("utf-8"), "text/html; charset=utf-8")

        def _send_bytes(self, status: int, raw: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(raw)))
            self._cors_headers()
            self.end_headers()
            self.wfile.write(raw)

        def log_message(self, fmt, *args):
            sys.stderr.write("%s - %s\n" % (self.log_date_time_string(), fmt % args))

    # (메서드, 경로, 핸들러 이름). 위에서부터 먼저 맞는 것을 쓴다.
    ROUTES = (
        ("GET", re.compile(r"^/health$"), "ep_health"),
        ("GET", re.compile(r"^/meta$"), "ep_meta"),
        ("GET", re.compile(r"^/companies$"), "ep_companies"),
        ("POST", re.compile(r"^/sessions$"), "ep_create_session"),
        ("POST", re.compile(r"^/sessions/(?P<sid>[\w-]+)/messages$"), "ep_message"),
        ("POST", re.compile(r"^/sessions/(?P<sid>[\w-]+)/persona$"), "ep_switch_persona"),
        ("DELETE", re.compile(r"^/sessions/(?P<sid>[\w-]+)$"), "ep_delete_session"),
    )
    return Handler


_PLAYGROUND_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                "playground.html")


def _playground_html() -> str:
    try:
        with open(_PLAYGROUND_PATH, encoding="utf-8") as f:
            return f.read()
    except OSError:
        return ("<!doctype html><meta charset=utf-8><p>playground.html을 찾지 못했습니다. "
                "같은 폴더에 파일이 있는지 확인하세요.</p>")


_SESSION_GONE = ("세션을 찾을 수 없습니다. 만료되었거나 서버가 다시 시작됐을 수 "
                 "있습니다. 세션을 새로 만들어 주세요.")


def _supported_personas(data: scores_source.ScoresData) -> list[dict]:
    """챗봇이 말할 수 있는 페르소나.

    순서는 PERSONAS를 따른다(= masters.ts의 MASTERS 순서). 화면의 대가 선택기가
    받은 순서대로 그리므로, scores.json의 순서를 따르면 사이트와 어긋난다.

    점수를 내는 대가는 scores.json에 스타일이 있어야 한다. 없으면 채점 기준을
    실을 수 없다. 채점하지 않는 대가는 scores.json과 무관하므로 항상 나간다.
    """
    out = []
    for pid, persona in PERSONAS.items():
        if persona["kind"] == "score":
            style = data.styles.get(pid)
            if style is None:
                continue
            out.append({"id": pid, "name": style.name,
                        "evaluation": "score",
                        "modelVersion": style.model_version})
        else:
            # modelVersion을 지어내지 않는다. 채점 모델이 아예 없다.
            out.append({"id": pid, "name": persona["name"],
                        "evaluation": "checklist"})
    return out


def _check_persona(persona: str, data: scores_source.ScoresData) -> None:
    known = [p["id"] for p in _supported_personas(data)]
    if persona not in known:
        raise HttpError(400, "unknown_persona",
                        f"지원하지 않는 관점입니다: {persona}. 쓸 수 있는 값: {known}")


def _lookup(store: SessionStore, session_id: str):
    try:
        return store.get(session_id), session_id
    except SessionNotFound:
        raise HttpError(404, "session_not_found", _SESSION_GONE) from None


def _run(func, *args):
    """LLM 호출을 감싸 상위 서비스 오류를 502로 바꾼다."""
    try:
        return func(*args)
    except HttpError:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HttpError(502, "model_error",
                        f"모델 호출에 실패했습니다: {type(exc).__name__}") from None


def _session_payload(chat: PersonaChat, reply) -> dict:
    company = chat.company
    return {
        "persona": chat.persona_key,
        "personaName": chat.persona_name,
        "evaluation": persona_kind(chat.persona_key),
        "company": company.summary() if company is not None else None,
        "asOf": company.as_of if company is not None else None,
        "judgement": chat.judgement.summary() if chat.judgement is not None else None,
        "opening": reply.text,
        "verdict": reply.verdict,
        "regenerated": reply.regenerated,
        "blocked": reply.blocked,
    }


def make_server(host: str = "127.0.0.1", port: int = 8000, force_mock: bool = False,
                adapter=None, store: SessionStore | None = None,
                limiter: RateLimiter | None = None,
                data: scores_source.ScoresData | None = None):
    """서버 객체를 만든다. 테스트는 port=0으로 불러 빈 포트를 받아 쓴다."""
    load_dotenv_file()
    if data is None:
        data = scores_source.get_data()
    if adapter is None:
        adapter, note = build_adapter(force_mock)
    else:
        note = f"주입된 어댑터({adapter.name})"
    if store is None:
        store = SessionStore()
    if limiter is None:
        limiter = RateLimiter(MAX_LLM_CALLS_PER_MINUTE)
    adapter = RateLimitedAdapter(adapter, limiter)
    allowed = os.getenv("ALLOWED_ORIGINS", "*")

    handler = make_handler(adapter, store, data, allowed)
    httpd = ThreadingHTTPServer((host, port), handler)
    httpd.daemon_threads = True
    # 띄운 뒤 확인·정리에 쓰라고 붙여 둔다
    httpd.persona_adapter = adapter
    httpd.persona_store = store
    httpd.persona_data = data
    httpd.persona_limiter = limiter
    httpd.persona_note = note
    return httpd


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", line_buffering=True)
        except (AttributeError, OSError):
            pass

    args = sys.argv[1:]
    force_mock = "--mock" in args
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    if "--port" in args:
        port = int(args[args.index("--port") + 1])
    if "--host" in args:
        host = args[args.index("--host") + 1]

    httpd = make_server(host, port, force_mock=force_mock)
    data = httpd.persona_data
    print("=" * 66)
    print("페르소나 지표 해설 챗봇 서버")
    print(f"  주소     http://{host}:{httpd.server_address[1]}  ← 브라우저에서 이 주소를 여세요")
    print(f"  어댑터   {httpd.persona_note}")
    print(f"  데이터   {data.path}")
    print(f"           종목 {len(data)}개 · 관점 {[p['id'] for p in _supported_personas(data)]}")
    print(f"           기준일 가격 {data.as_of.get('price')} / 재무 {data.as_of.get('financial')}")
    print(f"  CORS     {os.getenv('ALLOWED_ORIGINS', '*')}")
    print(f"  호출상한 분당 {MAX_LLM_CALLS_PER_MINUTE}회 (전역 LLM 비용 회로차단)")
    if os.getenv("ALLOWED_ORIGINS", "*") == "*":
        print("  ⚠ CORS가 * 입니다. 공개 배포 시 ALLOWED_ORIGINS를 프론트 출처로 잠그세요.")
    print("=" * 66)
    print("브라우저에서 위 주소를 여세요. 루트(/)는 연습장 화면, /health 는 JSON입니다.")
    print("종료는 Ctrl+C")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n종료합니다.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
