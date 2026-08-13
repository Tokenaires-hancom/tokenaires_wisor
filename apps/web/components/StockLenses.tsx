"use client";

import { useEffect, useState } from "react";
import CriteriaBar from "./CriteriaBar";
import { FinancialText } from "./FinancialTerm";
import WatchButton from "./WatchButton";
import { MASTER_BY_ID } from "@/content/masters";
import { displayModelVersion, formatMetric } from "@/lib/format";
import { METRIC_LABELS, type Company } from "@/lib/scores.types";
import { NOTE_STATUS_LABEL, getNote, saveNote, type NoteStatus } from "@/lib/store";
import { track } from "@/lib/analytics";

type Lens = "business" | "note";

const LENS_LABEL: Record<Lens, string> = {
  business: "기업 관점",
  note: "나의 학습노트",
};

const LENS_NOTE: Record<Lens, string> = {
  business: "어떤 기업을 관심 있게 볼 것인가 — 대가의 기준으로 이 회사를 훑어봅니다.",
  note: "기업 관점에서 확인한 것을 기록해 두고, 판단은 직접 내립니다.",
};

function scoreModelLabel(id: string, company: Company) {
  if (id === "greenblatt") return "그린블랫";
  return MASTER_BY_ID[id as keyof typeof MASTER_BY_ID]?.name.split(" · ")[0] ?? id;
}

export default function StockLenses({
  company,
  initialStyle,
}: {
  company: Company;
  initialStyle: string;
}) {
  const [lens, setLens] = useState<Lens>("business");
  const [styleId, setStyleId] = useState(initialStyle);
  const score = company.scores[styleId];
  const displayedModelVersion = score ? displayModelVersion(score.modelVersion) : "";

  return (
    <>
      <div className="lens-tabs" role="tablist" aria-label="종목을 보는 관점">
        {(Object.keys(LENS_LABEL) as Lens[]).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            className="lens-tab"
            aria-selected={lens === key}
            onClick={() => setLens(key)}
          >
            {LENS_LABEL[key]}
          </button>
        ))}
      </div>

      <p className="lens-note">{LENS_NOTE[lens]}</p>

      {lens === "business" && (
        <BusinessLens company={company} styleId={styleId} onStyleChange={setStyleId} />
      )}
      {lens === "note" && <NoteLens company={company} styleId={styleId} />}

      {lens === "business" && score && (
        <p className="disclaimer">
          이 결과는 {displayedModelVersion} 모델이 공개된 재무데이터에 같은 규칙을 적용한 것입니다.
          기업을 좁히는 출발점이며, 매수·매도 판단이 아닙니다.
        </p>
      )}
    </>
  );
}

function BusinessLens({
  company,
  styleId,
  onStyleChange,
}: {
  company: Company;
  styleId: string;
  onStyleChange: (id: string) => void;
}) {
  const score = company.scores[styleId];
  if (!score) return <p>이 철학의 점수가 없습니다.</p>;
  const displayedModelVersion = displayModelVersion(score.modelVersion);

  const passed = score.criteria.filter((c) => c.status === "pass");
  const failed = score.criteria.filter((c) => c.status === "fail");
  const unknown = score.criteria.filter((c) => c.status === "unknown");
  const rankModel = styleId.startsWith("greenblatt");
  const unscorableReason = score.unscorableReason ?? company.unscorableReason;
  const judgedWeight = score.criteria
    .filter((c) => c.status !== "unknown")
    .reduce((sum, c) => sum + c.weight, 0);
  const passedWeight = score.criteria
    .filter((c) => c.status === "pass")
    .reduce((sum, c) => sum + c.weight, 0);
  const totalWeight = score.criteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {Object.keys(company.scores).map((id) => (
          <button
            key={id}
            type="button"
            className="btn"
            data-variant={id === styleId ? undefined : "quiet"}
            onClick={() => onStyleChange(id)}
          >
            {scoreModelLabel(id, company)}{" "}
            {company.scores[id].rank !== undefined
              ? `#${company.scores[id].rank}`
              : company.scores[id].score !== null
                ? `${company.scores[id].score}점`
                : company.scores[id].dataConfidence}
          </button>
        ))}
      </div>

      <div className="card">
        <p className="eyebrow">
          {unscorableReason
            ? `${displayedModelVersion} · 판정 대상 아님`
            : rankModel
            ? `${displayedModelVersion} · 질 ${score.rankComponents?.quality}위 · 가격 ${score.rankComponents?.value}위`
            : `${displayedModelVersion} · 판정한 ${score.totalJudged}개 기준 중 ${score.passed}개 충족`}
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginBottom: "1rem" }}>
          <span className="score-value" style={{ fontSize: "2.2rem" }}>
            {score.rank !== undefined ? `#${score.rank}` : (score.score ?? "—")}
          </span>
          <span className="score-of">
            {score.rank !== undefined ? "종합 순위" : score.score !== null ? "점" : score.dataConfidence}
          </span>
        </div>
        {/* 왜 점수가 없는지는 '데이터가 없다'와 '모델이 안 맞는다'가 전혀 다르다 */}
        {unscorableReason ? (
          <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-soft)" }}>
            {unscorableReason} 아래 지표는 그대로 확인할 수 있습니다.
          </p>
        ) : (
          <>
            <CriteriaBar criteria={score.criteria} showBreakdown showLegend />
            {score.modelVersion === "Buffett 1.0" && (
              <div className="score-model-note">
                <h3>Buffett 1.0은 8개 기준, 총 {totalWeight}점입니다</h3>
                <p>
                  좋은 기업인지 10점, 재무가 버틸 수 있는지 3점, 성장이 이어지는지 2점,
                  가격이 과하지 않은지 3점으로 봅니다.
                </p>
                <p>데이터가 없는 기준은 맞거나 틀렸다고 보지 않고, 점수 계산에서도 잠시 빼 둡니다.</p>
              </div>
            )}
            <p className="score-formula">
              {rankModel
                ? `순위식: 품질 순위 ${score.rankComponents?.quality} + 가격 순위 ${score.rankComponents?.value}. 합이 낮을수록 상위입니다.`
                : `판정 가능한 ${judgedWeight}점 중 ${passedWeight}점을 채워 ${score.score ?? "—"}점입니다. 판정 불가 기준은 계산에서 뺍니다.`}
            </p>
          </>
        )}
      </div>

      <h3 className="sub" style={{ marginTop: "2rem" }}>
        {rankModel ? "상위 절반인 지표" : "이 철학에 맞는 점"} ({passed.length})
      </h3>
      <ul className="reason-list">
        {passed.map((c) => (
          <li key={c.code} data-kind="pass">
            <FinancialText text={c.message} />
          </li>
        ))}
        {passed.length === 0 && <li data-kind="unknown">충족한 기준이 없습니다.</li>}
      </ul>

      <h3 className="sub" style={{ marginTop: "2rem" }}>
        {rankModel ? "하위 절반이거나 정보가 부족한 지표" : "확인이 필요한 점"} ({failed.length + unknown.length})
      </h3>
      <ul className="reason-list">
        {failed.map((c) => (
          <li key={c.code} data-kind="fail">
            <FinancialText text={c.message} />
          </li>
        ))}
        {unknown.map((c) => (
          <li key={c.code} data-kind="unknown">
            <FinancialText text={c.label} /> — <FinancialText text={c.message} />
          </li>
        ))}
        {failed.length + unknown.length === 0 && (
          <li data-kind="pass">이 철학의 기준은 모두 충족했습니다. 기준 밖의 위험은 직접 확인해야 합니다.</li>
        )}
      </ul>

      <details className="criterion-audit">
        <summary>기준식과 실제 판정 데이터 펼쳐보기</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">기준</th>
              <th scope="col">수식</th>
              <th scope="col">실제 데이터</th>
              <th scope="col">결과</th>
            </tr>
          </thead>
          <tbody>
            {score.criteria.map((c) => (
              <tr key={c.code} data-status={c.status}>
                <th scope="row">
                  <FinancialText text={c.label} />
                  <span className="criterion-weight">가중치 {c.weight}점</span>
                </th>
                <td className="mono">
                  <FinancialText text={c.detail} />
                </td>
                <td><FinancialText text={c.message} /></td>
                <td>
                  {c.status === "pass" ? "충족" : c.status === "fail" ? "미충족" : "판정 불가"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>원자료 지표</h3>
        <table>
          <tbody>
            {Object.entries(METRIC_LABELS).map(([key, meta]) => (
              <tr key={key}>
                <th scope="row"><FinancialText text={meta.label} /></th>
                <td className="mono" colSpan={3}>
                  {formatMetric(company.metrics[key], meta.format, meta.cap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}

function NoteLens({ company, styleId }: { company: Company; styleId: string }) {
  const score = company.scores[styleId];
  const [why, setWhy] = useState("");
  const [questions, setQuestions] = useState("");
  const [status, setStatus] = useState<NoteStatus>("first");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void getNote(company.ticker).then((existing) => {
      if (!alive || !existing) return;
      setWhy(existing.whyInterested);
      setQuestions(existing.openQuestions);
      setStatus(existing.status);
      setSavedAt(existing.updatedAt);
    });
    return () => {
      alive = false;
    };
  }, [company.ticker]);

  async function save() {
    const note = await saveNote({
      ticker: company.ticker,
      name: company.name,
      whyInterested: why,
      styleScores: Object.entries(company.scores).map(([id, s]) => ({
        styleId: id,
        label: scoreModelLabel(id, company),
        score: s.score,
      })),
      strengths: score?.reasons ?? [],
      risks: score?.risks ?? [],
      openQuestions: questions,
      status,
    });
    setSavedAt(note.updatedAt);
    track("study_note_saved", { ticker: company.ticker });
  }

  return (
    <div style={{ maxWidth: "680px" }}>
      <label className="field">
        <span>1. 이 기업에 관심을 가진 이유</span>
        <textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="내 말로 적어보세요." />
      </label>

      <div className="card" style={{ marginBottom: "1.25rem" }}>
        <p className="eyebrow">2. 투자 철학별 적합도</p>
        <ul className="reason-list">
          {Object.entries(company.scores).map(([id, s]) => (
            <li key={id} data-kind={s.score === null ? "unknown" : "pass"}>
              {scoreModelLabel(id, company)} —{" "}
              {s.rank !== undefined ? `종합 ${s.rank}위` : s.score === null ? s.dataConfidence : `${s.score}점`}
            </li>
          ))}
        </ul>

        <p className="eyebrow" style={{ marginTop: "1.25rem" }}>
          3. 기업 관점에서 확인한 강점
        </p>
        <ul className="reason-list">
          {(score?.reasons ?? []).slice(0, 4).map((r, i) => (
            <li key={i} data-kind="pass">
              {r}
            </li>
          ))}
        </ul>

        <p className="eyebrow" style={{ marginTop: "1.25rem" }}>
          4. 기업 관점에서 확인한 위험
        </p>
        <ul className="reason-list">
          {(score?.risks ?? []).slice(0, 4).map((r, i) => (
            <li key={i} data-kind="fail">
              {r}
            </li>
          ))}
        </ul>
      </div>

      <label className="field">
        <span>5. 추가로 확인할 질문</span>
        <textarea
          rows={3}
          value={questions}
          onChange={(e) => setQuestions(e.target.value)}
          placeholder="다음 실적에서 무엇을 확인할지 적어두면 나중에 되짚기 좋습니다."
        />
      </label>

      <fieldset style={{ border: 0, padding: 0, margin: "0 0 1.5rem" }}>
        <legend style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
          6. 나의 판단
        </legend>
        {(Object.keys(NOTE_STATUS_LABEL) as NoteStatus[]).map((key) => (
          <button
            key={key}
            type="button"
            className="choice"
            data-state={status === key ? "correct" : undefined}
            aria-pressed={status === key}
            onClick={() => setStatus(key)}
          >
            {NOTE_STATUS_LABEL[key]}
          </button>
        ))}
      </fieldset>

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={() => void save()}>
          학습노트 저장
        </button>
        <WatchButton ticker={company.ticker} />
        {savedAt && (
          <span className="mono" style={{ color: "var(--ink-faint)" }}>
            마지막 저장 {new Date(savedAt).toLocaleString("ko-KR")}
          </span>
        )}
      </div>

      <p className="disclaimer">
        학습노트는 지금 이 브라우저에만 저장됩니다. 계정 연동은 다음 단계에서 붙습니다.
      </p>
    </div>
  );
}
