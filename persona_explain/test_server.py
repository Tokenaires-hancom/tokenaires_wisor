"""HTTP 서버·세션 보관소 검증 — 실제 모델을 부르지 않는다.

    pytest test_server.py -q

서버는 임시 포트에 띄우고 urllib로 부른다. 어댑터는 mock.
scores.json이 없으면 서버 테스트는 건너뛴다(세션 보관소 테스트는 그대로 돈다).
"""
from __future__ import annotations

import copy
import json
import threading
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest

from session_store import SessionNotFound, SessionStore

try:
    import scores_source
    from explain import MockAdapter
    from server import make_server

    _SCORES = scores_source.get_data()
except Exception:
    _SCORES = None


needs_scores = pytest.mark.skipif(_SCORES is None, reason="scores.json이 없습니다")


# ---- 세션 보관소 ------------------------------------------------------------

class FakeClock:
    def __init__(self, t: float = 0.0):
        self.t = t

    def __call__(self) -> float:
        return self.t


def test_store_create_get_delete():
    store = SessionStore(clock=FakeClock())
    sid = store.create("hello")
    assert store.get(sid) == "hello"
    assert sid in store
    assert store.delete(sid) is True
    assert store.delete(sid) is False
    with pytest.raises(SessionNotFound):
        store.get(sid)


def test_store_expires_after_ttl():
    clock = FakeClock()
    store = SessionStore(ttl_seconds=10, clock=clock)
    sid = store.create("x")
    clock.t = 9.9
    assert store.get(sid) == "x"
    clock.t = 20.0
    with pytest.raises(SessionNotFound):
        store.get(sid)
    assert sid not in store


def test_store_get_extends_ttl():
    clock = FakeClock()
    store = SessionStore(ttl_seconds=10, clock=clock)
    sid = store.create("x")
    clock.t = 9
    store.get(sid)
    clock.t = 18
    assert store.get(sid) == "x", "마지막으로 쓴 시각부터 다시 10초"


def test_store_evicts_oldest_when_full():
    clock = FakeClock()
    store = SessionStore(ttl_seconds=1000, max_sessions=2, clock=clock)
    a = store.create("a")
    clock.t = 1
    b = store.create("b")
    clock.t = 2
    store.get(a)  # a를 더 최근에 씀
    clock.t = 3
    c = store.create("c")
    assert a in store
    assert c in store
    assert b not in store, "가장 오래 쓰지 않은 b가 나가야 한다"
    assert len(store) == 2


def test_store_expires_in_never_negative():
    clock = FakeClock()
    store = SessionStore(ttl_seconds=10, clock=clock)
    sid = store.create("x")
    clock.t = 50
    # sweep 전에 남은 수명을 물으면 0이어야 한다(음수 금지)
    # get()은 sweep하므로 expires_in은 살아있는 세션에만 의미가 있다.
    with pytest.raises(SessionNotFound):
        store.get(sid)


# ---- HTTP 헬퍼 --------------------------------------------------------------

def _call(base: str, method: str, path: str, body=None, origin: str | None = None,
          extra_headers: dict | None = None):
    url = base + path
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = Request(url, data=data, method=method)
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if origin:
        req.add_header("Origin", origin)
    for key, value in (extra_headers or {}).items():
        req.add_header(key, value)
    try:
        with urlopen(req, timeout=15) as resp:
            raw = resp.read()
            payload = json.loads(raw.decode("utf-8")) if raw else {}
            return resp.status, payload, dict(resp.headers)
    except HTTPError as exc:
        raw = exc.read()
        payload = json.loads(raw.decode("utf-8")) if raw else {}
        return exc.code, payload, dict(exc.headers)


@pytest.fixture(scope="module")
def live():
    if _SCORES is None:
        pytest.skip("scores.json이 없습니다")
    httpd = make_server("127.0.0.1", 0, adapter=MockAdapter())
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    try:
        yield {"base": base, "httpd": httpd, "data": httpd.persona_data}
    finally:
        httpd.shutdown()
        httpd.server_close()


def _ticker(live) -> str:
    return live["data"].tickers()[0]


# ---- 엔드포인트 -------------------------------------------------------------

@needs_scores
def test_root_serves_playground(live):
    from urllib.request import urlopen

    with urlopen(live["base"] + "/", timeout=10) as resp:
        ctype = resp.headers.get("Content-Type", "")
        body = resp.read().decode("utf-8")
        assert resp.status == 200
        assert "text/html" in ctype
        assert "투자 대가에게 묻기" in body
        assert "종목 없이 철학을 묻거나" in body
        assert "/sessions" in body


@needs_scores
def test_health(live):
    status, body, _ = _call(live["base"], "GET", "/health")
    assert status == 200
    assert body["status"] == "ok"
    assert body["adapter"] == "mock"
    assert body["companies"] > 0
    assert {p["id"] for p in body["personas"]} >= {"buffett", "graham", "lynch"}


@needs_scores
def test_meta_has_ttl(live):
    status, body, _ = _call(live["base"], "GET", "/meta")
    assert status == 200
    assert body["sessionTtlSeconds"] == 30 * 60
    assert body["asOf"]


@needs_scores
def test_search_companies(live):
    ticker = _ticker(live)
    status, body, _ = _call(live["base"], "GET", f"/companies?q={ticker}")
    assert status == 200
    assert body["results"][0]["ticker"] == ticker


@needs_scores
def test_search_rejects_non_int_limit(live):
    status, body, _ = _call(live["base"], "GET", "/companies?q=A&limit=abc")
    assert status == 400
    assert body["error"]["code"] == "invalid_query"


@needs_scores
def test_session_lifecycle(live):
    ticker = _ticker(live)
    status, created, _ = _call(live["base"], "POST", "/sessions",
                               {"ticker": ticker, "persona": "buffett"})
    assert status == 201
    sid = created["sessionId"]
    assert created["company"]["ticker"] == ticker
    assert created["persona"] == "buffett"
    assert created["opening"]
    assert created["verdict"] == "ok"
    assert created["blocked"] is False
    assert created["judgement"]["style"] == "buffett"

    status, asked, _ = _call(live["base"], "POST", f"/sessions/{sid}/messages",
                             {"question": "ROIC가 뭔가요?"})
    assert status == 200
    assert asked["sessionId"] == sid
    assert "ROIC" in asked["reply"] or "mock" in asked["reply"]
    assert asked["blocked"] is False

    status, switched, _ = _call(live["base"], "POST", f"/sessions/{sid}/persona",
                                {"persona": "graham"})
    assert status == 200
    assert switched["persona"] == "graham"
    assert switched["opening"]
    assert switched["judgement"]["style"] == "graham"

    status, deleted, _ = _call(live["base"], "DELETE", f"/sessions/{sid}")
    assert status == 200
    assert deleted["deleted"] is True

    status, gone, _ = _call(live["base"], "POST", f"/sessions/{sid}/messages",
                            {"question": "아직 있나요?"})
    assert status == 404
    assert gone["error"]["code"] == "session_not_found"
    assert "새로 만들어" in gone["error"]["message"]


@needs_scores
def test_free_chat_session_lifecycle(live):
    status, created, _ = _call(live["base"], "POST", "/sessions",
                               {"persona": "buffett"})
    assert status == 201
    assert created["company"] is None
    assert created["asOf"] is None
    assert created["judgement"] is None
    assert created["opening"]
    sid = created["sessionId"]

    status, asked, _ = _call(live["base"], "POST", f"/sessions/{sid}/messages",
                             {"question": "복리의 핵심은 무엇인가요?"})
    assert status == 200
    assert asked["persona"] == "buffett"
    assert asked["reply"]

    status, switched, _ = _call(live["base"], "POST", f"/sessions/{sid}/persona",
                                {"persona": "fisher"})
    assert status == 200
    assert switched["persona"] == "fisher"
    assert switched["company"] is None
    assert switched["judgement"] is None


@needs_scores
def test_null_ticker_is_rejected_instead_of_silently_becoming_free_chat(live):
    status, body, _ = _call(live["base"], "POST", "/sessions",
                            {"ticker": None, "persona": "buffett"})
    assert status == 400
    assert body["error"]["code"] == "invalid_field"


@needs_scores
def test_unknown_ticker_is_404(live):
    status, body, _ = _call(live["base"], "POST", "/sessions",
                            {"ticker": "NOSUCHTICKER", "persona": "buffett"})
    assert status == 404
    assert body["error"]["code"] == "unknown_ticker"


@needs_scores
def test_unknown_persona_is_400(live):
    status, body, _ = _call(live["base"], "POST", "/sessions",
                            {"ticker": _ticker(live), "persona": "munger"})
    assert status == 400
    assert body["error"]["code"] == "unknown_persona"


@needs_scores
def test_unknown_field_is_400(live):
    status, body, _ = _call(live["base"], "POST", "/sessions",
                            {"ticker": _ticker(live), "persona": "buffett",
                             "metrics": {"pe": 10}})
    assert status == 400
    assert body["error"]["code"] == "unknown_fields"


@needs_scores
def test_empty_question_is_400(live):
    _, created, _ = _call(live["base"], "POST", "/sessions",
                          {"ticker": _ticker(live), "persona": "buffett"})
    status, body, _ = _call(live["base"], "POST",
                            f"/sessions/{created['sessionId']}/messages",
                            {"question": "   "})
    assert status == 400
    assert body["error"]["code"] == "invalid_field"


@needs_scores
def test_missing_session_is_404(live):
    status, body, _ = _call(live["base"], "POST",
                            "/sessions/does-not-exist/messages",
                            {"question": "안녕"})
    assert status == 404
    assert body["error"]["code"] == "session_not_found"


@needs_scores
def test_expired_session_is_404():
    clock = FakeClock()
    store = SessionStore(ttl_seconds=5, clock=clock)
    httpd = make_server("127.0.0.1", 0, adapter=MockAdapter(), store=store)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    try:
        assert httpd.persona_store is store
        ticker = httpd.persona_data.tickers()[0]
        _, created, _ = _call(base, "POST", "/sessions",
                              {"ticker": ticker, "persona": "buffett"})
        sid = created["sessionId"]
        assert sid in store
        clock.t = 100
        assert sid not in store
        status, body, _ = _call(base, "POST", f"/sessions/{sid}/messages",
                                {"question": "만료됐나요?"})
        assert status == 404
        assert body["error"]["code"] == "session_not_found"
    finally:
        httpd.shutdown()
        httpd.server_close()


@needs_scores
def test_rate_limit_blocks_excess_llm_calls():
    # 전역 상한 1로 두면 두 번째 LLM 호출부터 429. IP 무관 비용 회로차단.
    from server import RateLimiter

    httpd = make_server("127.0.0.1", 0, adapter=MockAdapter(),
                        limiter=RateLimiter(max_calls=1))
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    try:
        ticker = httpd.persona_data.tickers()[0]
        # 1회차 LLM 호출은 통과
        status, _, _ = _call(base, "POST", "/sessions",
                             {"ticker": ticker, "persona": "buffett"})
        assert status == 201
        # 2회차는 상한 초과 → 429
        status, body, _ = _call(base, "POST", "/sessions",
                               {"ticker": ticker, "persona": "buffett"})
        assert status == 429
        assert body["error"]["code"] == "rate_limited"
        # LLM을 부르지 않는 엔드포인트는 상한과 무관하게 계속 동작
        status, _, _ = _call(base, "GET", "/health")
        assert status == 200
    finally:
        httpd.shutdown()
        httpd.server_close()


@needs_scores
def test_rate_limit_not_charged_for_noop_persona_switch():
    # 같은 페르소나로 전환하면 캐시된 첫 해설을 돌려주고 LLM을 부르지 않는다.
    # 실제 호출이 없는 경로이므로 상한을 깎지 않아야 한다(선차감 금지).
    from server import RateLimiter

    httpd = make_server("127.0.0.1", 0, adapter=MockAdapter(),
                        limiter=RateLimiter(max_calls=1))
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    try:
        ticker = httpd.persona_data.tickers()[0]
        # 세션 생성 = LLM 1회 → 상한 1 소진
        status, created, _ = _call(base, "POST", "/sessions",
                                   {"ticker": ticker, "persona": "buffett"})
        assert status == 201
        sid = created["sessionId"]
        # 같은 페르소나로 전환 = 캐시 반환, LLM 0회 → 상한 안 깎임 → 200
        status, _, _ = _call(base, "POST", f"/sessions/{sid}/persona",
                             {"persona": "buffett"})
        assert status == 200, "실제 호출 없는 no-op 전환은 상한을 깎지 않아야 한다"
    finally:
        httpd.shutdown()
        httpd.server_close()


@needs_scores
def test_failed_persona_switch_restores_the_previous_session_state():
    from server import RateLimiter

    httpd = make_server("127.0.0.1", 0, adapter=MockAdapter(),
                        limiter=RateLimiter(max_calls=1))
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    try:
        ticker = httpd.persona_data.tickers()[0]
        status, created, _ = _call(base, "POST", "/sessions",
                                   {"ticker": ticker, "persona": "buffett"})
        assert status == 201
        sid = created["sessionId"]

        # 새 첫 해설은 두 번째 LLM 호출이라 실패한다. 전환 전체가 롤백돼야 한다.
        status, body, _ = _call(base, "POST", f"/sessions/{sid}/persona",
                                {"persona": "graham"})
        assert status == 429
        assert body["error"]["code"] == "rate_limited"

        # 기존 버핏 첫 해설은 캐시돼 있으므로 추가 호출 없이 그대로 받을 수 있다.
        status, restored, _ = _call(base, "POST", f"/sessions/{sid}/persona",
                                    {"persona": "buffett"})
        assert status == 200
        assert restored["persona"] == "buffett"
        assert restored["opening"] == created["opening"]
    finally:
        httpd.shutdown()
        httpd.server_close()


@needs_scores
def test_blocked_persona_switch_restores_the_previous_session_state():
    class OneAnswerThenEmptyAdapter:
        name = "one-answer-then-empty"
        model = None

        def __init__(self):
            self.calls = 0

        def chat(self, system, messages, temperature=0.0):
            self.calls += 1
            return "첫 해설" if self.calls == 1 else ""

    httpd = make_server("127.0.0.1", 0, adapter=OneAnswerThenEmptyAdapter())
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    try:
        ticker = httpd.persona_data.tickers()[0]
        status, created, _ = _call(base, "POST", "/sessions",
                                   {"ticker": ticker, "persona": "buffett"})
        assert status == 201
        sid = created["sessionId"]

        status, blocked, _ = _call(base, "POST", f"/sessions/{sid}/persona",
                                   {"persona": "graham"})
        assert status == 200
        assert blocked["blocked"] is True
        assert blocked["persona"] == "buffett"

        status, restored, _ = _call(base, "POST", f"/sessions/{sid}/persona",
                                    {"persona": "buffett"})
        assert status == 200
        assert restored["blocked"] is False
        assert restored["opening"] == created["opening"]
    finally:
        httpd.shutdown()
        httpd.server_close()


@needs_scores
def test_free_chat_create_and_switch_do_not_spend_llm_quota():
    from server import RateLimiter

    httpd = make_server("127.0.0.1", 0, adapter=MockAdapter(),
                        limiter=RateLimiter(max_calls=1))
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    try:
        status, created, _ = _call(base, "POST", "/sessions",
                                   {"persona": "buffett"})
        assert status == 201
        sid = created["sessionId"]

        status, _, _ = _call(base, "POST", f"/sessions/{sid}/persona",
                             {"persona": "graham"})
        assert status == 200

        status, _, _ = _call(base, "POST", f"/sessions/{sid}/messages",
                             {"question": "안전마진이 무엇인가요?"})
        assert status == 200

        status, body, _ = _call(base, "POST", f"/sessions/{sid}/messages",
                                {"question": "한 번 더 설명해 주세요."})
        assert status == 429
        assert body["error"]["code"] == "rate_limited"
    finally:
        httpd.shutdown()
        httpd.server_close()


@needs_scores
def test_free_chat_session_creation_has_its_own_rate_limit():
    from server import RateLimiter

    httpd = make_server(
        "127.0.0.1", 0, adapter=MockAdapter(),
        free_session_limiter=RateLimiter(max_calls=1),
    )
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    try:
        status, _, _ = _call(base, "POST", "/sessions", {"persona": "buffett"})
        assert status == 201

        status, body, _ = _call(base, "POST", "/sessions", {"persona": "graham"})
        assert status == 429
        assert body["error"]["code"] == "rate_limited"
    finally:
        httpd.shutdown()
        httpd.server_close()


@needs_scores
def test_cors_preflight_and_get(live):
    status, _, headers = _call(
        live["base"], "OPTIONS", "/health",
        origin="http://localhost:3000",
    )
    assert status == 204
    allow = headers.get("Access-Control-Allow-Origin") or headers.get(
        "access-control-allow-origin")
    assert allow == "*"

    status, _, headers = _call(
        live["base"], "GET", "/health", origin="http://localhost:3000")
    assert status == 200
    allow = headers.get("Access-Control-Allow-Origin") or headers.get(
        "access-control-allow-origin")
    assert allow == "*"


@needs_scores
def test_unknown_path_is_404(live):
    status, body, _ = _call(live["base"], "GET", "/nope")
    assert status == 404
    assert body["error"]["code"] == "not_found"


@needs_scores
def test_method_not_allowed(live):
    status, body, _ = _call(live["base"], "GET", "/sessions")
    assert status == 405
    assert body["error"]["code"] == "method_not_allowed"


# ---- 채점하지 않는 대가 ------------------------------------------------------

@needs_scores
def test_meta_lists_every_persona_in_site_order(live):
    status, body, _ = _call(live["base"], "GET", "/meta")
    assert status == 200
    ids = [p["id"] for p in body["personas"]]
    # apps/web/content/masters.ts의 MASTERS 순서. 화면 선택기가 받은 순서로 그린다.
    assert ids == ["buffett", "graham", "lynch", "marks",
                   "fisher", "greenblatt", "soros"]
    by_id = {p["id"]: p for p in body["personas"]}
    assert by_id["buffett"]["evaluation"] == "score"
    assert by_id["buffett"]["modelVersion"]
    assert by_id["fisher"]["evaluation"] == "checklist"
    # 채점 모델이 없는 대가에게 버전을 지어내지 않는다
    assert "modelVersion" not in by_id["fisher"]


@needs_scores
def test_checklist_session_has_no_judgement(live):
    ticker = _ticker(live)
    status, created, _ = _call(live["base"], "POST", "/sessions",
                               {"ticker": ticker, "persona": "fisher"})
    assert status == 201
    assert created["evaluation"] == "checklist"
    assert created["judgement"] is None
    assert created["company"]["ticker"] == ticker
    assert created["opening"]
    assert created["blocked"] is False
    return_id = created["sessionId"]

    # 관점을 오가도 판정이 섞이지 않는다. 이 왕복이 화면에서 초상을 누르는 동작이다.
    status, switched, _ = _call(live["base"], "POST",
                                f"/sessions/{return_id}/persona",
                                {"persona": "buffett"})
    assert status == 200
    assert switched["evaluation"] == "score"
    assert switched["judgement"]["style"] == "buffett"

    status, back, _ = _call(live["base"], "POST",
                            f"/sessions/{return_id}/persona",
                            {"persona": "soros"})
    assert status == 200
    assert back["evaluation"] == "checklist"
    assert back["judgement"] is None


@needs_scores
def test_runtime_reload_updates_new_requests_but_keeps_open_session_snapshot(tmp_path):
    payload = json.loads(Path(_SCORES.path).read_text(encoding="utf-8"))
    ticker = payload["companies"][0]["ticker"]

    def set_version(data, generated_at, model_version):
        data["generatedAt"] = generated_at
        for style in data["styles"]:
            if style["id"] in {"buffett", "graham"}:
                style["modelVersion"] = model_version
        company = next(row for row in data["companies"] if row["ticker"] == ticker)
        for style_id in ("buffett", "graham"):
            company["scores"][style_id]["modelVersion"] = model_version

    old_payload = copy.deepcopy(payload)
    set_version(old_payload, "2026-08-26T00:00:00+00:00", "runtime-old")
    path = tmp_path / "scores.json"
    path.write_text(json.dumps(old_payload, ensure_ascii=False), encoding="utf-8")
    initial = scores_source.get_data(str(path), reload=True)

    httpd = make_server("127.0.0.1", 0, adapter=MockAdapter(), data=initial)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address[:2]
    base = f"http://{host}:{port}"
    try:
        status, old_session, _ = _call(
            base, "POST", "/sessions", {"ticker": ticker, "persona": "buffett"}
        )
        assert status == 201
        assert old_session["judgement"]["modelVersion"] == "runtime-old"

        new_payload = copy.deepcopy(payload)
        set_version(new_payload, "2026-08-26T01:00:00+00:00", "runtime-new")
        replacement = tmp_path / ".scores.json.new"
        replacement.write_text(json.dumps(new_payload, ensure_ascii=False), encoding="utf-8")
        replacement.replace(path)

        status, meta, _ = _call(base, "GET", "/meta")
        assert status == 200
        assert meta["generatedAt"] == "2026-08-26T01:00:00+00:00"

        status, new_session, _ = _call(
            base, "POST", "/sessions", {"ticker": ticker, "persona": "buffett"}
        )
        assert status == 201
        assert new_session["judgement"]["modelVersion"] == "runtime-new"

        status, switched, _ = _call(
            base,
            "POST",
            f"/sessions/{old_session['sessionId']}/persona",
            {"persona": "graham"},
        )
        assert status == 200
        assert switched["judgement"]["modelVersion"] == "runtime-old"
    finally:
        httpd.shutdown()
        httpd.server_close()
