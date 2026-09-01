"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";
import {
  askQuestion,
  createSession,
  deleteSession,
  getHealth,
  isAmbiguousSessionFailure,
  isGone,
  searchCompanies,
  switchPersona,
  type CompanyHit,
  type PersonaInfo,
} from "@/lib/personaApi";

type Bubble = { role: "user" | "tutor"; text: string };

// /health가 오기 전에 그릴 기본값. 구성과 순서는 서버의 personas와 맞춘다
// (= content/masters.ts의 MASTERS 순서). 막스·피셔·소로스는 점수를 내지 않아
// scores.json에 없고, 종목 이름만 받아 확인 질문으로 답한다.
const FALLBACK_PERSONAS: PersonaInfo[] = [
  { id: "buffett", name: "워런 버핏·찰리 멍거", evaluation: "score" },
  { id: "graham", name: "벤저민 그레이엄", evaluation: "score" },
  { id: "lynch", name: "피터 린치", evaluation: "score" },
  { id: "marks", name: "하워드 막스", evaluation: "checklist" },
  { id: "fisher", name: "필립 피셔", evaluation: "checklist" },
  { id: "greenblatt", name: "조엘 그린블랫", evaluation: "score" },
  { id: "soros", name: "조지 소로스", evaluation: "checklist" },
];

const CHATTABLE = new Set(FALLBACK_PERSONAS.map((p) => p.id));
const FAIL_COPY = "답변을 불러오지 못했습니다. 잠시 후 다시 시도하세요.";

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

function discardSession(sessionId: string) {
  void deleteSession(sessionId).catch((err) => {
    console.debug("[wisor] persona chat session cleanup failed", err);
  });
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
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CompanyHit[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const searchSeq = useRef(0);
  const conversationSeq = useRef(0);
  const panelSeq = useRef(0);

  useEffect(() => {
    conversationSeq.current += 1;
    setTicker(pathTicker);
    setSessionId(null);
    setMessages([]);
    setBusy(false);
    setError(null);
    if (urlStyle && CHATTABLE.has(urlStyle)) setPersona(urlStyle);
  }, [pathTicker, urlStyle]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, open]);

  // 챗봇은 별도 서비스라 유휴 상태에서 잠든다. 버튼을 누른 뒤에 깨우면 그 대기가
  // 사용자에게 그대로 보이므로, 화면을 읽는 동안 미리 한 번 깨워 둔다.
  // 실패해도 아무것도 하지 않는다 — 열 때 fetchPersonas가 다시 확인하고 그때 안내한다.
  useEffect(() => {
    getHealth()
      .then((health) => {
        const list = (health.personas ?? []).filter((p) => CHATTABLE.has(p.id));
        if (list.length) setPersonas(list);
      })
      .catch((err) => console.debug("[wisor] persona chat prewarm failed", err));
  }, []);

  async function fetchPersonas(): Promise<PersonaInfo[]> {
    const health = await getHealth();
    const list = (health.personas ?? []).filter((p) => CHATTABLE.has(p.id));
    return list.length ? list : FALLBACK_PERSONAS;
  }

  async function start(
    nextTicker: string,
    nextPersona = persona,
    panelGeneration?: number,
  ) {
    const seq = ++conversationSeq.current;
    const stale = () =>
      seq !== conversationSeq.current ||
      (panelGeneration !== undefined && panelGeneration !== panelSeq.current);
    setBusy(true);
    setError(null);
    try {
      const reply = await createSession(nextTicker, nextPersona);
      if (stale()) {
        discardSession(reply.sessionId);
        return;
      }
      if (reply.blocked) {
        discardSession(reply.sessionId);
        setError(reply.text);
        return;
      }
      setTicker(nextTicker);
      setPersona(reply.persona);
      setSessionId(reply.sessionId);
      setMessages([{ role: "tutor", text: reply.text }]);
      setHits([]);
      track("persona_chat_opened", { ticker: nextTicker, persona: reply.persona });
    } catch (err) {
      if (stale()) return;
      console.debug("[wisor] persona chat start failed", err);
      setError(FAIL_COPY);
    } finally {
      if (seq === conversationSeq.current) setBusy(false);
    }
  }

  function closePanel() {
    // 패널을 여는 동안 기다리던 health 응답이 닫힌 뒤 종목 세션을 만들지 못하게 한다.
    panelSeq.current += 1;
    setOpen(false);
  }

  async function onToggle() {
    const next = !open;
    const panelGeneration = ++panelSeq.current;
    setOpen(next);
    if (!next) return;
    const seq = conversationSeq.current;
    setError(null);
    let nextPersonas: PersonaInfo[];
    try {
      nextPersonas = await fetchPersonas();
    } catch (err) {
      if (
        seq !== conversationSeq.current ||
        panelGeneration !== panelSeq.current
      ) return;
      console.debug("[wisor] persona chat health failed", err);
      setError(FAIL_COPY);
      return;
    }
    if (
      seq !== conversationSeq.current ||
      panelGeneration !== panelSeq.current
    ) return;
    setPersonas(nextPersonas);
    const resolvedPersona = nextPersonas.some((p) => p.id === persona)
      ? persona
      : nextPersonas[0].id;
    if (resolvedPersona !== persona) setPersona(resolvedPersona);
    if (ticker && !sessionId) {
      void start(ticker, resolvedPersona, panelGeneration);
    }
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

  function onClearTicker() {
    if (!ticker) return;
    const activeSessionId = sessionId;

    conversationSeq.current += 1;
    searchSeq.current += 1;
    setTicker(null);
    setSessionId(null);
    setMessages([]);
    setQuery("");
    setHits([]);
    setQuestion("");
    setBusy(false);
    setError(null);

    if (activeSessionId) discardSession(activeSessionId);
  }

  async function onAsk(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    let rollbackMessages = messages;
    let activeSessionId = sessionId;
    setQuestion("");
    setMessages([...rollbackMessages, { role: "user", text }]);
    setBusy(true);
    setError(null);
    const seq = ++conversationSeq.current;
    try {
      if (!activeSessionId) {
        const opened = await createSession(ticker, persona);
        if (seq !== conversationSeq.current) {
          discardSession(opened.sessionId);
          return;
        }
        if (opened.blocked) {
          discardSession(opened.sessionId);
          setMessages(rollbackMessages);
          setQuestion(text);
          setError(opened.text);
          return;
        }
        activeSessionId = opened.sessionId;
        setSessionId(activeSessionId);
      }
      let reply;
      try {
        reply = await askQuestion(activeSessionId, text);
      } catch (err) {
        if (!isGone(err)) throw err;
        if (seq !== conversationSeq.current) return;
        activeSessionId = null;
        rollbackMessages = [];
        setSessionId(null);
        const opened = await createSession(ticker, persona);
        if (seq !== conversationSeq.current) {
          discardSession(opened.sessionId);
          return;
        }
        if (opened.blocked) {
          discardSession(opened.sessionId);
          setMessages([]);
          setQuestion(text);
          setError(opened.text);
          return;
        }
        activeSessionId = opened.sessionId;
        rollbackMessages = [{ role: "tutor", text: opened.text }];
        setSessionId(activeSessionId);
        setMessages([...rollbackMessages, { role: "user", text }]);
        reply = await askQuestion(activeSessionId, text);
      }
      if (seq !== conversationSeq.current) {
        discardSession(reply.sessionId);
        return;
      }
      if (reply.blocked) {
        setMessages(rollbackMessages);
        setQuestion(text);
        setError(reply.text);
        return;
      }
      setMessages((prev) => [...prev, { role: "tutor", text: reply.text }]);
      track("persona_chat_asked", { ticker, persona: reply.persona });
    } catch (err) {
      if (seq !== conversationSeq.current) return;
      console.debug("[wisor] persona chat ask failed", err);
      if (isAmbiguousSessionFailure(err)) {
        // 서버가 답변을 기록한 뒤 응답만 유실됐을 수 있다. 화면에 없는 문맥을
        // 이어가지 않도록 어느 쪽인지 모호한 세션과 표시 기록을 함께 버린다.
        if (activeSessionId) discardSession(activeSessionId);
        setSessionId(null);
        setMessages([]);
      } else {
        // 429·검증 실패·model_error는 서버가 질문을 기록하지 않은 것이 확정적이다.
        // 낙관적으로 그린 사용자 말풍선만 되돌리면 기존 문맥을 그대로 이어갈 수 있다.
        setMessages(rollbackMessages);
        setQuestion(text);
      }
      setError(FAIL_COPY);
    } finally {
      if (seq === conversationSeq.current) setBusy(false);
    }
  }

  async function onPersona(id: string) {
    if (id === persona) return;
    if (!sessionId) {
      setError(null);
      if (ticker) await start(ticker, id);
      else {
        conversationSeq.current += 1;
        setPersona(id);
        setMessages([]);
      }
      return;
    }
    const activeSessionId = sessionId;
    const seq = ++conversationSeq.current;
    let sessionGone = false;
    setBusy(true);
    setError(null);
    try {
      let reply;
      try {
        reply = await switchPersona(activeSessionId, id);
      } catch (err) {
        if (!isGone(err)) throw err;
        if (seq !== conversationSeq.current) return;
        sessionGone = true;
        setSessionId(null);
        reply = await createSession(ticker, id);
        if (seq !== conversationSeq.current) {
          discardSession(reply.sessionId);
          return;
        }
        setSessionId(reply.sessionId);
      }
      if (seq !== conversationSeq.current) {
        discardSession(reply.sessionId);
        return;
      }
      if (reply.blocked) {
        if (sessionGone) {
          discardSession(reply.sessionId);
          setSessionId(null);
          setMessages([]);
        }
        setError(reply.text);
        return;
      }
      setPersona(reply.persona);
      setMessages([{ role: "tutor", text: reply.text }]);
    } catch (err) {
      if (seq !== conversationSeq.current) return;
      console.debug("[wisor] persona chat switch failed", err);
      // 명시적인 model_error·429는 서버가 전환을 롤백했으므로 기존 문맥을 보존한다.
      // 응답 유실처럼 반영 여부가 모호하거나 404가 확인된 세션만 화면에서도 버린다.
      if (sessionGone || isAmbiguousSessionFailure(err)) {
        if (!sessionGone) discardSession(activeSessionId);
        setSessionId(null);
        setMessages([]);
      }
      setError(FAIL_COPY);
    } finally {
      if (seq === conversationSeq.current) setBusy(false);
    }
  }

  // 점수를 내지 않는 대가는 숫자를 읽어 주지 않는다. 빈 화면 문구까지 같으면
  // 사용자가 오지 않을 숫자 해설을 기다린다.
  const checklistPersona =
    personas.find((item) => item.id === persona)?.evaluation === "checklist";
  const emptyCopy = !ticker
    ? "종목 없이도 투자 철학과 판단 기준을 자유롭게 물어볼 수 있습니다."
    : checklistPersona
      ? "이 관점은 점수를 내지 않습니다. 무엇을 확인해야 하는지 알려줍니다."
      : "이 종목의 공개 숫자로 기준을 설명합니다.";
  const selectedPersona =
    personas.find((item) => item.id === persona) ?? FALLBACK_PERSONAS[0];

  function onQuestionKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="persona-dock">
      {open && (
        <section
          className="persona-panel"
          role="dialog"
          aria-labelledby="persona-panel-heading"
        >
          <header className="persona-panel-head">
            <div className="persona-panel-title">
              <div>
                <p>투자 철학 해설</p>
                <h2 id="persona-panel-heading">투자 대가에게 묻기</h2>
              </div>
              <button
                type="button"
                className="persona-close"
                onClick={closePanel}
                aria-label="대화창 닫기"
              >
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
                  aria-label={`${item.name} 관점 선택`}
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

          <div className="persona-context" aria-live="polite">
            <div>
              <span>선택한 관점</span>
              <strong>{shortName(selectedPersona.name)}</strong>
            </div>
            <span className="persona-context-kind">
              {!ticker ? "자유 대화" : checklistPersona ? "확인 질문" : "숫자 해설"}
            </span>
            {ticker && (
              <button
                type="button"
                className="persona-context-ticker mono"
                aria-label={`${ticker} 종목 선택 해제`}
                title="종목 선택 해제"
                onClick={onClearTicker}
              >
                <span>{ticker}</span>
                <span className="persona-context-ticker-close" aria-hidden="true">×</span>
              </button>
            )}
          </div>

          {(!pathTicker || !ticker) && (
            <div className="persona-search">
              <label htmlFor="persona-ticker">종목 선택 (선택 사항)</label>
              <input
                id="persona-ticker"
                value={query}
                placeholder="선택 사항 · 티커 또는 종목 이름"
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

          <div className="persona-log" ref={logRef} aria-live="polite" aria-busy={busy}>
            {messages.length === 0 && !error && (
              <p className="persona-empty">{emptyCopy}</p>
            )}
            {messages.map((bubble, index) => (
              <div key={`${bubble.role}-${index}`} className="persona-message" data-role={bubble.role}>
                <span className="persona-message-author">
                  {bubble.role === "user" ? "나" : shortName(selectedPersona.name)}
                </span>
                <p className="persona-bubble">{bubble.text}</p>
              </div>
            ))}
            {busy && <p className="persona-thinking">답변을 준비하고 있습니다…</p>}
          </div>

          <footer className="persona-compose">
            {error && <p className="persona-error" role="alert">{error}</p>}
            <form className="persona-ask" onSubmit={(event) => void onAsk(event)}>
              <label htmlFor="persona-question">질문</label>
              <textarea
                id="persona-question"
                value={question}
                maxLength={500}
                rows={2}
                placeholder={
                  ticker
                    ? "이 회사에서 무엇을 확인할까요?"
                    : "투자 철학이나 판단 기준을 물어보세요"
                }
                disabled={busy}
                onKeyDown={onQuestionKeyDown}
                onChange={(event) => setQuestion(event.target.value)}
              />
              <button className="btn" type="submit" disabled={busy || !question.trim()}>
                {busy ? "확인 중" : "묻기"}
              </button>
            </form>
            <div className="persona-compose-meta">
              <span>Enter 전송 · Shift+Enter 줄바꿈</span>
            </div>
          </footer>
        </section>
      )}

      <button
        type="button"
        className="persona-fab"
        aria-expanded={open}
        aria-label={open ? "대가에게 묻기 닫기" : "이 철학으로 묻기"}
        onClick={() => void onToggle()}
      >
        <span className="persona-fab-mark">ASK</span>
        <span className="persona-fab-label">대가에게 묻기</span>
      </button>
    </div>
  );
}
