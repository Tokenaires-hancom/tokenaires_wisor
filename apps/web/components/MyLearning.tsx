"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHART_LESSONS, LESSON_BY_ID } from "@/content/chartLessons";
import { MASTERS, MASTER_BY_ID } from "@/content/masters";
import {
  NOTE_STATUS_LABEL,
  deleteNote,
  getNotes,
  getProgress,
  getWatchlist,
  type Progress,
  type StudyNote,
} from "@/lib/store";

export default function MyLearning({ names }: { names: Record<string, string> }) {
  const [progress, setProgress] = useState<Progress>({ lessonsDone: [], quizResults: {} });
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    async function refresh() {
      const [p, w, n] = await Promise.all([getProgress(), getWatchlist(), getNotes()]);
      if (!alive) return;
      setProgress(p);
      setWatchlist(w);
      setNotes(n);
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

  const masterDone = MASTERS.filter((m) => progress.lessonsDone.includes(`master:${m.id}`));
  const chartDone = CHART_LESSONS.filter((l) => progress.lessonsDone.includes(`chart:${l.id}`));
  const bothLenses = notes.filter((n) => n.chartObservations.length > 0 && n.strengths.length > 0);

  if (!ready) {
    return (
      <div className="wrap" style={{ paddingBlock: "3.5rem" }}>
        <p className="lede">불러오는 중입니다…</p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingBlock: "3.5rem 5rem" }}>
      <p className="eyebrow">내 학습</p>
      <h1 className="thesis" style={{ maxWidth: "22ch" }}>
        지금까지 무엇을 확인했나요?
      </h1>

      <div className="grid" style={{ marginTop: "2rem" }}>
        <div className="card">
          <p className="eyebrow">투자 대가 학습</p>
          <p className="score-value">
            {masterDone.length}
            <span className="score-of"> / {MASTERS.length}</span>
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">차트 기초 단원</p>
          <p className="score-value">
            {chartDone.length}
            <span className="score-of"> / {CHART_LESSONS.length}</span>
          </p>
        </div>
        <div className="card">
          <p className="eyebrow">두 관점을 함께 적은 노트</p>
          <p className="score-value">
            {bothLenses.length}
            <span className="score-of"> / {notes.length || 0}</span>
          </p>
        </div>
      </div>

      <hr className="rule" />

      <h2 className="section">퀴즈 결과</h2>
      {Object.keys(progress.quizResults).length === 0 ? (
        <p className="lede">
          아직 푼 퀴즈가 없습니다. <Link href="/learn" style={{ color: "var(--plum)" }}>배우기</Link>에서
          한 스타일을 먼저 끝까지 봐보세요.
        </p>
      ) : (
        <ul className="reason-list">
          {Object.entries(progress.quizResults).map(([id, r]) => {
            const [kind, key] = id.split(":");
            const label =
              kind === "master"
                ? MASTER_BY_ID[key as keyof typeof MASTER_BY_ID]?.name
                : LESSON_BY_ID[key]?.title;
            return (
              <li key={id} data-kind={r.correct === r.total ? "pass" : "fail"}>
                {label ?? id} — {r.total}문항 중 {r.correct}문항
              </li>
            );
          })}
        </ul>
      )}

      <hr className="rule" />

      <h2 className="section">관심종목 ({watchlist.length})</h2>
      {watchlist.length === 0 ? (
        <p className="lede">
          아직 담은 종목이 없습니다.{" "}
          <Link href="/screener/buffett" style={{ color: "var(--plum)" }}>종목 찾기</Link>에서
          살펴볼 종목을 골라보세요.
        </p>
      ) : (
        <div className="grid">
          {watchlist.map((ticker) => (
            <Link key={ticker} href={`/stocks/${ticker}`} className="card card-link">
              <strong>{names[ticker] ?? ticker}</strong>
              <span className="stock-ticker">{ticker}</span>
            </Link>
          ))}
        </div>
      )}

      <hr className="rule" />

      <h2 className="section">종목 학습노트 ({notes.length})</h2>
      <p className="lede">
        기업 관점과 차트 관점에서 확인한 것을 한자리에 모아 둔 기록입니다. 시간이 지난 뒤 처음의
        판단 근거를 다시 읽는 것이 이 노트의 목적입니다.
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

              <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "1rem" }}>
                <div>
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
                <div>
                  <p className="eyebrow">차트 관점</p>
                  <ul className="reason-list">
                    {note.chartObservations.length === 0 ? (
                      <li data-kind="unknown">아직 기록하지 않았습니다.</li>
                    ) : (
                      note.chartObservations.slice(0, 3).map((s, i) => <li key={i} data-kind="pass">{s}</li>)
                    )}
                  </ul>
                </div>
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
        학습 기록은 지금 이 브라우저에만 저장됩니다. 다른 기기에서는 보이지 않으며, 브라우저
        데이터를 지우면 함께 사라집니다.
      </p>
    </div>
  );
}
