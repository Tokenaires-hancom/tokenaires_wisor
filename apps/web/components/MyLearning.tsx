"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AccountSettings from "@/components/AccountSettings";
import { CHAPTER_SLOTS } from "@/content/curriculum/types";
import { MASTERS, MASTER_BY_ID } from "@/content/masters";
import { money } from "@/lib/format";
import { xpTotal, levelFor, streakDays, dailyGoalMet, masterBadges } from "@/lib/gamification";
import "./game/game-panel.css";
import WisorTown from "@/components/game/WisorTown";
import {
  NOTE_STATUS_LABEL,
  deleteNote,
  dueJournalEntries,
  getNotes,
  getProgress,
  getStorageMode,
  getWatchlist,
  saveJournalEntry,
  type JournalEntry,
  type LearningStorageMode,
  type Progress,
  type StudyNote,
} from "@/lib/store";

export type WatchCompanyInfo = {
  name: string;
  sector: string;
  price: number;
  marketCap: number;
  marketCapRank?: number;
  universeSize: number;
  priceAsOf: string;
};

const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function MyLearning({ companies }: { companies: Record<string, WatchCompanyInfo> }) {
  const [progress, setProgress] = useState<Progress>({ lessonsDone: [], quizResults: {} });
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [due, setDue] = useState<JournalEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [storageMode, setStorageMode] = useState<LearningStorageMode>("browser");
  const [ready, setReady] = useState(false);
  const [activeSection, setActiveSection] = useState("my-learning");

  useEffect(() => {
    let alive = true;
    async function refresh() {
      const [p, w, n, j, mode] = await Promise.all([
        getProgress(),
        getWatchlist(),
        getNotes(),
        dueJournalEntries(),
        getStorageMode(),
      ]);
      if (!alive) return;
      setProgress(p);
      setWatchlist(w);
      setNotes(n);
      setDue(j);
      setStorageMode(mode);
      setReady(true);
    }
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener("wisor:store", onChange);
    return () => {
      alive = false;
      window.removeEventListener("wisor:store", onChange);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const sectionIds = ["my-learning", "watchlist", "account-settings"];
    const updateActiveSection = () => {
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= 130) current = id;
      }
      setActiveSection(current);
    };
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, [ready]);

  const totalChapters = MASTERS.length * CHAPTER_SLOTS.length;
  const chaptersDone = progress.lessonsDone.filter((id) => {
    const [kind, masterId, chapter] = id.split(":");
    const no = Number(chapter);
    return (
      kind === "master" &&
      masterId in MASTER_BY_ID &&
      Number.isInteger(no) &&
      no >= 1 &&
      no <= CHAPTER_SLOTS.length
    );
  }).length;

  // 게이미피케이션 지표 — 진도에서 파생 (저장하지 않음)
  const xp = xpTotal(progress);
  const lvl = levelFor(xp);
  const now = Date.now();
  const streak = streakDays(progress, now);
  const goalMet = dailyGoalMet(progress, now);
  const badges = masterBadges(progress);
  const xpBarPct =
    lvl.xpToNext === 0
      ? 100
      : Math.round((lvl.xpIntoLevel / (lvl.xpIntoLevel + lvl.xpToNext)) * 100);

  const quizResults = Object.entries(progress.quizResults).filter(
    ([id]) => !id.startsWith("basics:"),
  );
  const quizItems = quizResults
    .map(([id, result]) => {
      const [kind, key, no] = id.split(":");
      const master = kind === "master" ? MASTER_BY_ID[key as keyof typeof MASTER_BY_ID] : undefined;
      const chapterNo = Number(no);
      const slot = Number.isInteger(chapterNo) ? CHAPTER_SLOTS[chapterNo - 1] : undefined;
      const masterIndex = MASTERS.findIndex((item) => item.id === key);
      const chapterOrder = Number.isInteger(chapterNo) ? chapterNo : CHAPTER_SLOTS.length + 1;

      return {
        id,
        result,
        masterId: master?.id,
        chapterNo: slot?.no ?? chapterOrder,
        chapterLabel: slot ? `${slot.no}장 · ${slot.label}` : id,
        href: master && slot ? `/learn/masters/${key}/${slot.no}` : undefined,
        order: masterIndex === -1 ? Number.MAX_SAFE_INTEGER : masterIndex * 100 + chapterOrder,
      };
    })
    .sort((a, b) => a.order - b.order);
  const ungroupedQuizItems = quizItems.filter((item) => item.masterId === undefined);
  const quizGroups = [
    ...MASTERS.map((master) => ({
      id: master.id,
      name: master.name.split(" · ")[0],
      items: quizItems.filter((item) => item.masterId === master.id),
    })).filter((group) => group.items.length > 0),
    ...(ungroupedQuizItems.length > 0
      ? [{ id: "other", name: "기타 학습 기록", items: ungroupedQuizItems }]
      : []),
  ];
  const quizCorrect = quizItems.reduce((sum, item) => sum + item.result.correct, 0);
  const quizTotal = quizItems.reduce((sum, item) => sum + item.result.total, 0);
  const perfectQuizzes = quizItems.filter(
    (item) => item.result.total > 0 && item.result.correct === item.result.total,
  ).length;
  const reviewQuizzes = quizItems.length - perfectQuizzes;

  if (!ready) {
    return (
      <div className="wrap" style={{ paddingBlock: "3.5rem" }}>
        <p className="lede">불러오는 중입니다…</p>
      </div>
    );
  }

  return (
    <div className="wrap my-page-shell">
      <aside className="my-page-sidebar">
        <p className="eyebrow">개인 기록</p>
        <h1>마이페이지</h1>
        <nav className="my-page-menu" aria-label="마이페이지 메뉴">
          <a
            href="#my-learning"
            data-active={activeSection === "my-learning"}
            aria-current={activeSection === "my-learning" ? "location" : undefined}
            onClick={() => setActiveSection("my-learning")}
          >
            <span className="my-page-menu-index" aria-hidden="true">01</span>
            <span>
              <strong>내 학습</strong>
              <small>진도 · 퀴즈 · 노트 · 복습</small>
            </span>
          </a>
          <a
            href="#watchlist"
            data-active={activeSection === "watchlist"}
            aria-current={activeSection === "watchlist" ? "location" : undefined}
            onClick={() => setActiveSection("watchlist")}
          >
            <span className="my-page-menu-index" aria-hidden="true">02</span>
            <span>
              <strong>관심 종목</strong>
              <small>저장한 기업 다시 보기</small>
            </span>
          </a>
          <a
            href="#account-settings"
            data-active={activeSection === "account-settings"}
            aria-current={activeSection === "account-settings" ? "location" : undefined}
            onClick={() => setActiveSection("account-settings")}
          >
            <span className="my-page-menu-index" aria-hidden="true">03</span>
            <span>
              <strong>계정 설정</strong>
              <small>로그인 · 비밀번호 · 로그아웃</small>
            </span>
          </a>
        </nav>
      </aside>

      <main className="my-page-content">
        <span id="my-learning" className="my-page-anchor-marker" aria-hidden="true" />
        <p className="eyebrow">내 학습</p>
        <h2 className="thesis">
          지금까지 무엇을 확인했나요?
        </h2>

      <div className="game-panel">
        <div className="game-panel-top">
          <span className="game-streak">🔥 {streak}일 <small>연속 학습</small></span>
          <span className="game-level">Lv {lvl.level}</span>
        </div>
        <div className="game-xpbar" aria-label={`레벨 ${lvl.level}, 다음까지 ${lvl.xpToNext} XP`}>
          <i style={{ width: `${xpBarPct}%` }} />
        </div>
        <div className="game-panel-foot">
          <span>총 {xp} XP</span>
          <span className={goalMet ? "game-goal-met" : undefined}>
            오늘 목표 {goalMet ? "1 / 1 ✓" : "0 / 1"}
          </span>
        </div>
        {badges.length > 0 && (
          <div className="game-badges">
            {badges.map((id) => (
              <span key={id} className="game-badge" title={`${MASTER_BY_ID[id as keyof typeof MASTER_BY_ID]?.name} 완주`}>
                🏅 {MASTER_BY_ID[id as keyof typeof MASTER_BY_ID]?.name.split(" · ")[0]}
              </span>
            ))}
          </div>
        )}
      </div>

      <WisorTown progress={progress} />

      <div className="card" style={{ marginTop: "2rem" }}>
        <p className="eyebrow">투자 대가 챕터</p>
        <p className="score-value">
          {chaptersDone}
          <span className="score-of"> / {totalChapters}</span>
        </p>
      </div>

      <hr className="rule" />

      <h2 className="section">퀴즈 결과</h2>
      {quizItems.length === 0 ? (
        <p className="lede">
          아직 푼 확인 문항이 없습니다. <Link href="/learn" style={{ color: "var(--wine)" }}>배우기</Link>에서
          한 챕터를 끝까지 살펴보세요.
        </p>
      ) : (
        <section className="quiz-results" aria-label="퀴즈 학습 기록">
          <div className="quiz-results-overview">
            <div className="quiz-results-overview-copy">
              <p className="eyebrow">전체 학습 기록</p>
              <p className="quiz-results-total">
                <strong>{quizCorrect}</strong>
                <span> / {quizTotal}문항 정답</span>
              </p>
              <progress
                className="quiz-progress quiz-progress-overall"
                max={Math.max(quizTotal, 1)}
                value={quizCorrect}
                aria-label={`전체 ${quizTotal}문항 중 ${quizCorrect}문항 정답`}
              />
            </div>
            <dl className="quiz-results-summary">
              <div>
                <dt>풀어 본 챕터</dt>
                <dd>{quizItems.length}</dd>
              </div>
              <div>
                <dt>모두 맞힌 챕터</dt>
                <dd>{perfectQuizzes}</dd>
              </div>
              <div>
                <dt>다시 볼 챕터</dt>
                <dd>{reviewQuizzes}</dd>
              </div>
            </dl>
          </div>

          <div className="quiz-master-groups">
            {quizGroups.map((group) => {
              const groupCorrect = group.items.reduce(
                (sum, item) => sum + item.result.correct,
                0,
              );
              const groupTotal = group.items.reduce((sum, item) => sum + item.result.total, 0);

              return (
                <details key={group.id} className="quiz-master-group" open>
                  <summary>
                    <div className="quiz-master-name">
                      <span>투자 대가</span>
                      <h3>{group.name}</h3>
                    </div>
                    <div className="quiz-master-summary">
                      <span>{group.items.length}개 챕터</span>
                      <span>
                        <strong>{groupCorrect}</strong> / {groupTotal}문항 정답
                      </span>
                    </div>
                    <span className="quiz-master-toggle" aria-hidden="true" />
                  </summary>

                  <ol className="quiz-result-list">
                    {group.items.map(({ id, result, chapterNo, chapterLabel, href }) => {
                      const missed = Math.max(result.total - result.correct, 0);
                      const isPerfect = result.total > 0 && missed === 0;
                      const date = Number.isNaN(Date.parse(result.at))
                        ? undefined
                        : result.at.slice(0, 10);

                      return (
                        <li
                          key={id}
                          className="quiz-result-card"
                          data-status={isPerfect ? "perfect" : "review"}
                        >
                          <span className="quiz-result-index" aria-hidden="true">
                            {String(chapterNo).padStart(2, "0")}
                          </span>
                          <div className="quiz-result-main">
                            <div className="quiz-result-heading">
                              <h3>{chapterLabel}</h3>
                              <p
                                className="quiz-result-score"
                                aria-label={`${result.total}문항 중 ${result.correct}문항 정답`}
                              >
                                <strong>{result.correct}</strong>
                                <span> / {result.total}</span>
                              </p>
                            </div>

                            <progress
                              className="quiz-progress"
                              max={Math.max(result.total, 1)}
                              value={result.correct}
                              aria-hidden="true"
                            />

                            <div className="quiz-result-footer">
                              <span className="quiz-result-status">
                                {isPerfect ? "모두 확인했어요" : `${missed}문항 다시 확인`}
                              </span>
                              {date && (
                                <time dateTime={result.at}>{date.replaceAll("-", ".")}</time>
                              )}
                              {href && (
                                <Link href={href} className="quiz-result-link">
                                  챕터 다시 보기 <span aria-hidden="true">→</span>
                                </Link>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </details>
              );
            })}
          </div>
        </section>
      )}

      <hr className="rule" />

      <section aria-labelledby="review-schedule-title">
        <p className="eyebrow">복습 일정</p>
        <h2 id="review-schedule-title" className="section">90일 뒤 다시 보는 기록</h2>
        {due.length === 0 ? (
          <p className="lede">
            지금 다시 볼 기록은 없습니다. 기록형 답은 작성한 지 90일이 지나면 이곳에 나타납니다.
          </p>
        ) : (
          <>
            <p className="lede">
              그때의 답과 지금의 생각이 다르면, 무엇이 바뀌었는지가 배운 것입니다.
            </p>
            <div className="stack">
              {due.map((entry) => (
                <div key={entry.id} className="card">
                  <h3 className="sub">{entry.prompt}</h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)" }}>
                    {entry.at.slice(0, 10)}에 쓴 답 — {entry.text}
                  </p>
                  <label className="field">
                    <span>지금의 답</span>
                    <textarea
                      rows={3}
                      value={drafts[entry.id] ?? ""}
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [entry.id]: event.target.value }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn"
                    disabled={(drafts[entry.id] ?? "").trim() === ""}
                    onClick={() => {
                      void saveJournalEntry(entry.id, entry.prompt, drafts[entry.id]).then(async () =>
                        setDue(await dueJournalEntries()),
                      );
                    }}
                  >
                    기록하기
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <hr className="rule" />

      <h2 className="section">종목 학습노트 ({notes.length})</h2>
      <p className="lede">
        기업 관점에서 확인한 것을 모아 둔 기록입니다. 시간이 지난 뒤 처음의 판단 근거를 다시
        읽는 것이 이 노트의 목적입니다.
      </p>
      {notes.length === 0 ? (
        <p className="lede">
          아직 작성한 노트가 없습니다. 종목 상세의 <strong>나의 학습노트</strong> 탭에서 첫 노트를
          남겨보세요.
        </p>
      ) : (
        <div className="stack">
          {notes.map((note) => (
            <div key={note.ticker} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <Link href={`/stocks/${note.ticker}`}>
                    <strong>{note.name}</strong>
                    <span className="stock-ticker">{note.ticker}</span>
                  </Link>
                </div>
                <span className="visibility">{NOTE_STATUS_LABEL[note.status]}</span>
              </div>

              {note.whyInterested && (
                <p style={{ fontSize: "0.92rem", marginTop: "0.9rem", marginBottom: 0 }}>
                  {note.whyInterested}
                </p>
              )}

              <div style={{ marginTop: "1rem" }}>
                <p className="eyebrow">기업 관점</p>
                <ul className="reason-list">
                  {note.strengths.slice(0, 2).map((s, i) => (
                    <li key={i} data-kind="pass">
                      {s}
                    </li>
                  ))}
                  {note.risks.slice(0, 1).map((s, i) => (
                    <li key={i} data-kind="fail">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {note.openQuestions && (
                <>
                  <p className="eyebrow" style={{ marginTop: "1rem" }}>
                    추가로 확인할 질문
                  </p>
                  <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
                    {note.openQuestions}
                  </p>
                </>
              )}

              <div className="stamp">
                <span>마지막 저장 {new Date(note.updatedAt).toLocaleString("ko-KR")}</span>
                <button
                  type="button"
                  onClick={() => {
                    void deleteNote(note.ticker).then(getNotes).then(setNotes);
                  }}
                  style={{
                    background: "none",
                    border: 0,
                    padding: 0,
                    color: "var(--ink-faint)",
                    textDecoration: "underline",
                    font: "inherit",
                  }}
                >
                  노트 지우기
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="disclaimer">
        {storageMode === "account"
          ? "학습 기록은 현재 로그인한 계정에 저장됩니다. 같은 계정으로 로그인하면 다른 기기에서도 이어서 볼 수 있습니다."
          : "학습 기록은 회원가입 전까지 이 브라우저에 임시 저장됩니다. 로그인하거나 가입하면 계정 기록과 합쳐져 이동합니다."}
      </p>

      <section id="watchlist" className="my-page-anchor-section" aria-labelledby="watchlist-title">
        <hr className="rule" />
        <div className="watchlist-heading">
          <div>
            <p className="eyebrow">기업 다시 보기</p>
            <h2 id="watchlist-title" className="section">관심 종목</h2>
          </div>
          <span>{watchlist.length}개 기업</span>
        </div>
        {watchlist.length === 0 ? (
          <div className="watchlist-empty">
            <div>
              <strong>아직 저장한 기업이 없습니다</strong>
              <p>종목을 저장하면 업종, 종가, 시가총액을 이곳에서 나란히 확인할 수 있습니다.</p>
            </div>
            <Link href="/screener/buffett" className="btn">
              종목 찾기
            </Link>
          </div>
        ) : (
          <ul className="watch-company-grid">
            {watchlist.map((ticker) => {
              const company = companies[ticker];
              const hasNote = notes.some((note) => note.ticker === ticker);

              if (!company) {
                return (
                  <li key={ticker} className="watch-company-card" data-missing="true">
                    <div className="watch-company-topline">
                      <span className="watch-company-tab">{ticker}</span>
                    </div>
                    <p className="watch-company-missing">
                      저장 당시 종목 정보를 현재 목록에서 찾지 못했습니다.
                    </p>
                  </li>
                );
              }

              return (
                <li key={ticker}>
                  <Link href={`/stocks/${ticker}`} className="watch-company-card">
                    <div className="watch-company-topline">
                      <span className="watch-company-tab">{ticker}</span>
                      {hasNote && <span className="watch-company-note">학습노트 있음</span>}
                    </div>

                    <div className="watch-company-identity">
                      <h3>{company.name}</h3>
                      <p>{company.sector || "업종 정보 없음"}</p>
                    </div>

                    <dl className="watch-company-facts">
                      <div>
                        <dt>종가</dt>
                        <dd>{PRICE_FORMATTER.format(company.price)}</dd>
                      </div>
                      <div>
                        <dt>시가총액</dt>
                        <dd>{money(company.marketCap)}</dd>
                      </div>
                      <div>
                        <dt>유니버스 내 규모</dt>
                        <dd>
                          {company.marketCapRank
                            ? `${company.marketCapRank}위 / ${company.universeSize}종목`
                            : "정보 없음"}
                        </dd>
                      </div>
                    </dl>

                    <div className="watch-company-footer">
                      <span>{company.priceAsOf.replaceAll("-", ".")} 종가 기준</span>
                      <strong>
                        기업 확인하기 <span aria-hidden="true">→</span>
                      </strong>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="account-settings" className="my-page-anchor-section" aria-labelledby="account-settings-title">
        <hr className="rule" />
        <p className="eyebrow">내 계정</p>
        <h2 id="account-settings-title" className="section">계정 설정</h2>
        <AccountSettings />
      </section>
      </main>
    </div>
  );
}
