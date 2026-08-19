"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import {
  askQuestion,
  createSession,
  getHealth,
  isGone,
  searchCompanies,
  switchPersona,
  type CompanyHit,
  type PersonaInfo,
} from "@/lib/personaApi";

type Bubble = { role: "user" | "tutor"; text: string };

const FALLBACK_PERSONAS: PersonaInfo[] = [
  { id: "buffett", name: "워런 버핏·찰리 멍거" },
  { id: "graham", name: "벤저민 그레이엄" },
  { id: "lynch", name: "피터 린치" },
  { id: "greenblatt", name: "조엘 그린블랫" },
];

const CHATTABLE = new Set(FALLBACK_PERSONAS.map((p) => p.id));
const FAIL_COPY = "해설을 불러오지 못했습니다. 잠시 후 다시 시도하세요.";

function tickerFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/stocks\/([^/?#]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]).toUpperCase() || null;
  } catch {
    return null;
  }
}

function shortName(name: string): string {
  return name.split("·")[0]?.trim() || name;
}

export default function PersonaChatFab() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const pathTicker = tickerFromPath(pathname);
  const urlStyle = searchParams.get("style");

  const [open, setOpen] = useState(false);
  const [personas, setPersonas] = useState<PersonaInfo[]>(FALLBACK_PERSONAS);
  const [persona, setPersona] = useState("buffett");
  const [ticker, setTicker] = useState<string | null>(pathTicker);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState("이 설명은 교육용이며 투자 조언이 아닙니다.");
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CompanyHit[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    setTicker(pathTicker);
    setSessionId(null);
    setMessages([]);
    setError(null);
    if (urlStyle && CHATTABLE.has(urlStyle)) setPersona(urlStyle);
  }, [pathTicker, urlStyle]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, open]);

  // 챗봇은 별도 서비스라 유휴 상태에서 잠든다. 버튼을 누른 뒤에 깨우면 그 대기가
  // 사용자에게 그대로 보이므로, 화면을 읽는 동안 미리 한 번 깨워 둔다.
  // 실패해도 아무것도 하지 않는다 — 열 때 ensureHealth가 다시 확인하고 그때 안내한다.
  useEffect(() => {
    getHealth()
      .then((health) => {
        const list = (health.personas ?? []).filter((p) => CHATTABLE.has(p.id));
        if (list.length) setPersonas(list);
      })
      .catch((err) => console.debug("[wisor] persona chat prewarm failed", err));
  }, []);

  async function ensureHealth(): Promise<string> {
    const health = await getHealth();
    const list = (health.personas ?? []).filter((p) => CHATTABLE.has(p.id));
    const next = list.length ? list : FALLBACK_PERSONAS;
    setPersonas(next);
    const resolved = next.some((p) => p.id === persona) ? persona : next[0].id;
    if (resolved !== persona) setPersona(resolved);
    return resolved;
  }

  async function start(nextTicker: string, nextPersona = persona) {
    setBusy(true);
    setError(null);
    try {
      const reply = await createSession(nextTicker, nextPersona);
      setTicker(nextTicker);
      setPersona(reply.persona);
      setSessionId(reply.sessionId);
      setDisclaimer(reply.disclaimer);
      setMessages([{ role: "tutor", text: reply.text }]);
      setHits([]);
      track("persona_chat_opened", { ticker: nextTicker, persona: reply.persona });
    } catch (err) {
      console.debug("[wisor] persona chat start failed", err);
      setError(FAIL_COPY);
    } finally {
      setBusy(false);
    }
  }

  async function onToggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    setError(null);
    let resolvedPersona: string;
    try {
      resolvedPersona = await ensureHealth();
    } catch (err) {
      console.debug("[wisor] persona chat health failed", err);
      setError(FAIL_COPY);
      return;
    }
    if (pathTicker && !sessionId) void start(pathTicker, resolvedPersona);
  }

  async function onSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      searchSeq.current += 1; // 리셋도 새 순번으로 — 늦게 온 이전 응답 무효화
      setHits([]);
      return;
    }
    const seq = ++searchSeq.current;
    try {
      const data = await searchCompanies(value.trim());
      if (seq === searchSeq.current) setHits(data.results);
    } catch (err) {
      console.debug("[wisor] persona chat search failed", err);
      if (seq === searchSeq.current) setHits([]);
    }
  }

  async function onAsk(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    if (!ticker) {
      setError("먼저 종목을 고르세요.");
      return;
    }
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    setError(null);
    try {
      let id = sessionId;
      if (!id) {
        const opened = await createSession(ticker, persona);
        id = opened.sessionId;
        setSessionId(id);
        setDisclaimer(opened.disclaimer);
      }
      let reply;
      try {
        reply = await askQuestion(id, text);
      } catch (err) {
        if (!isGone(err)) throw err;
        const opened = await createSession(ticker, persona);
        setSessionId(opened.sessionId);
        reply = await askQuestion(opened.sessionId, text);
      }
      setDisclaimer(reply.disclaimer);
      setMessages((prev) => [...prev, { role: "tutor", text: reply.text }]);
      track("persona_chat_asked", { ticker, persona: reply.persona });
    } catch (err) {
      console.debug("[wisor] persona chat ask failed", err);
      setError(FAIL_COPY);
    } finally {
      setBusy(false);
    }
  }

  async function onPersona(id: string) {
    setPersona(id);
    if (!ticker) return;
    setBusy(true);
    setError(null);
    try {
      if (!sessionId) {
        await start(ticker, id);
        return;
      }
      let reply;
      try {
        reply = await switchPersona(sessionId, id);
      } catch (err) {
        if (!isGone(err)) throw err;
        reply = await createSession(ticker, id);
        setSessionId(reply.sessionId);
      }
      setPersona(reply.persona);
      setDisclaimer(reply.disclaimer);
      setMessages([{ role: "tutor", text: reply.text }]);
    } catch (err) {
      console.debug("[wisor] persona chat switch failed", err);
      setError(FAIL_COPY);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="persona-dock">
      {open && (
        <section className="persona-panel" aria-label="투자 대가에게 묻기">
          <header className="persona-panel-head">
            <div className="persona-panel-title">
              <h2>투자 대가에게 묻기</h2>
              <button type="button" className="btn" data-variant="quiet" onClick={() => setOpen(false)}>
                닫기
              </button>
            </div>

            <div className="persona-personas" role="group" aria-label="투자 대가 선택">
              {personas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="persona-master-option"
                  aria-pressed={item.id === persona}
                  disabled={busy}
                  onClick={() => void onPersona(item.id)}
                >
                  <span className="persona-master-portrait" aria-hidden="true">
                    <img src={`/investors/${item.id}.png`} alt="" />
                  </span>
                  <span className="persona-master-name">{shortName(item.name)}</span>
                </button>
              ))}
            </div>
          </header>

          {!pathTicker && (
            <div className="persona-search">
              <label htmlFor="persona-ticker">종목</label>
              <input
                id="persona-ticker"
                value={query}
                placeholder="티커 또는 종목 이름"
                autoComplete="off"
                onChange={(event) => void onSearch(event.target.value)}
              />
              {hits.length > 0 && (
                <ul className="persona-hits">
                  {hits.map((hit) => (
                    <li key={hit.ticker}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setQuery(`${hit.ticker} ${hit.name}`);
                          void start(hit.ticker);
                        }}
                      >
                        <span className="mono">{hit.ticker}</span> {hit.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="persona-log" ref={logRef}>
            {messages.length === 0 && !error && (
              <p className="persona-empty">
                {pathTicker
                  ? "이 종목의 공개 숫자로 기준을 설명합니다."
                  : "종목을 고르면 그 회사의 숫자로 설명합니다."}
              </p>
            )}
            {messages.map((bubble, index) => (
              <p key={`${bubble.role}-${index}`} className="persona-bubble" data-role={bubble.role}>
                {bubble.text}
              </p>
            ))}
          </div>

          {error && <p className="persona-error">{error}</p>}
          <p className="disclaimer persona-disclaimer">{disclaimer}</p>

          <form className="persona-ask" onSubmit={(event) => void onAsk(event)}>
            <input
              value={question}
              maxLength={500}
              placeholder="무엇을 확인할까요?"
              disabled={busy || (!ticker && !pathTicker)}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button className="btn" type="submit" disabled={busy || !question.trim()}>
              묻기
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="persona-fab"
        aria-expanded={open}
        aria-label={open ? "숫자 해설 닫기" : "이 철학으로 숫자 해설 묻기"}
        onClick={() => void onToggle()}
      >
        ASK
      </button>
    </div>
  );
}
