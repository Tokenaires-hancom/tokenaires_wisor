"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { SCORING_STEPS } from "@/content/scoringSteps";

/** 대가 3명(피셔·막스·소로스)을 점수로 만들지 않는 이유. 정성 판단·시장 전체
 *  심리·자금 흐름처럼 재무 항목 하나로 못 재는 질문이라, 여기 채점 방식
 *  카드가 아니라 이 문구로만 짧게 설명한다. */
const UNSCORED_MASTERS = [
  { name: "필립 피셔", note: "탐문과 경영진의 정직성 같은 정성 판단" },
  { name: "하워드 막스", note: "개별 종목보다 시장 전체의 신용과 심리" },
  { name: "조지 소로스", note: "가격과 자금 흐름이 달라지는 과정" },
];

type Panel = "universe" | "scoring" | "unscored" | null;

/** 채점 방식 카드 아래 버튼들. 페이지 이동 대신 그 자리에서 펼쳐 보여준다 —
 *  오른쪽 칸이 이제 자기 안에서 스크롤하므로(globals.css의 .screener-split-detail)
 *  펼쳐도 화면이 안 깨진다. `/learn/scoring`은 철학별 채점 종목 수 같은 이
 *  종목 묶음에만 있는 숫자까지 다루므로 전체를 옮기지 않고 링크만 남긴다. */
export default function CriteriaLegendExtras({
  universeExplainer,
}: {
  /** 전체 종목 수·판정 제외 사유. 철학과 무관한 값이라 서버(CriteriaLegend)가
   *  미리 만들어 넘긴다 — lib/scores(서버 전용)를 여기서 직접 못 읽는다.
   *  데이터가 없으면(예시 데이터 등) undefined라 버튼 자체를 숨긴다. */
  universeExplainer?: ReactNode;
}) {
  const [open, setOpen] = useState<Panel>(null);

  function toggle(panel: Panel) {
    setOpen((current) => (current === panel ? null : panel));
  }

  return (
    <div className="criteria-legend-extras">
      <div className="criteria-legend-links">
        {universeExplainer && (
          <button
            type="button"
            className="btn"
            data-variant="quiet"
            aria-expanded={open === "universe"}
            onClick={() => toggle("universe")}
          >
            종목 선정 방법
          </button>
        )}
        <button
          type="button"
          className="btn"
          data-variant="quiet"
          aria-expanded={open === "scoring"}
          onClick={() => toggle("scoring")}
        >
          점수 채점 방법
        </button>
        <button
          type="button"
          className="btn"
          data-variant="quiet"
          aria-expanded={open === "unscored"}
          onClick={() => toggle("unscored")}
        >
          점수를 매기지 않는 철학
        </button>
      </div>

      {open === "universe" && universeExplainer}

      {open === "scoring" && (
        <div className="scoring-explainer-card">
          <ol className="scoring-steps">
            {SCORING_STEPS.map((step, i) => (
              <li key={step.title}>
                <p className="eyebrow">{i + 1}단계</p>
                <h3 className="sub" style={{ fontSize: "1.02rem", marginTop: "0.25rem" }}>
                  {step.title}
                </h3>
                <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", margin: "0.5rem 0 0" }}>
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
          <Link href="/learn/scoring" className="mono scoring-explainer-more">
            철학마다 종목 수가 다른 이유까지 자세히 보기 →
          </Link>
        </div>
      )}

      {open === "unscored" && (
        <div className="unscored-masters-card">
          <p className="eyebrow">점수를 매기지 않는 철학</p>
          <div className="unscored-masters-grid">
            {UNSCORED_MASTERS.map((m) => (
              <div key={m.name}>
                <strong>{m.name}</strong>
                <p>{m.note}</p>
              </div>
            ))}
          </div>
          <p className="unscored-masters-note">
            기업 재무 데이터로 억지로 점수화하면 본래 질문을 왜곡합니다. 세 철학은 스크리너 대신
            학습 화면의 자가진단으로 다룹니다.
          </p>
        </div>
      )}
    </div>
  );
}
