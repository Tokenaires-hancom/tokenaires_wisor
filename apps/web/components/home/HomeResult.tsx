"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import CriteriaBar from "@/components/CriteriaBar";
import type { CriterionResult } from "@/lib/scores.types";
import { useInView } from "@/lib/useInView";

export type ResultSample = {
  name: string;
  ticker: string;
  score: number | null;
  passed: number;
  total: number;
  modelLabel: string;
  criteria: CriterionResult[];
  reasons: string[];
  risks: string[];
};

/** DataStamp는 lib/scores(서버 전용)를 읽는다. 이 화면은 클라이언트라 직접 부르지 못하고,
 *  서버 컴포넌트에서 만들어 넘겨받는다.
 *
 *  journey와 같이 [useInView]를 쓴다 — 화면에서 나갔다 들어올 때마다 진입 동작을 다시 튼다. */
export default function HomeResult({ sample, stamp }: { sample: ResultSample; stamp: ReactNode }) {
  const [ref, seen] = useInView<HTMLElement>(0.3);

  return (
    <section
      ref={ref}
      className="hv-scene hv-result"
      data-in={seen ? "true" : undefined}
      aria-labelledby="hv-result-title"
    >
      <h2 id="hv-result-title" className="hv-result-title">
        점수보다 기준이 먼저 보입니다
      </h2>

      {/* 뒤에 겹친 두 장은 '다음 기준으로도 같은 화면을 본다'는 표시다. 내용이 아니라 두께를 보여준다. */}
      <div className="hv-result-panel hv-result-panel-back" aria-hidden="true">
        <span>성장 대비 가격</span>
      </div>
      <div className="hv-result-panel hv-result-panel-mid" aria-hidden="true">
        <strong>안전마진</strong>
        <span>다음 기준 · 준비 중</span>
      </div>

      <div className="hv-result-card">
        <p className="hv-result-name">
          {sample.name}
          <span className="hv-result-ticker">{sample.ticker}</span>
        </p>
        <p className="hv-result-score">{sample.score ?? "—"}</p>
        <p className="hv-result-model">
          {sample.modelLabel} · 판정 {sample.total}개 중 {sample.passed}개 충족
        </p>

        <div className="hv-result-bars">
          <CriteriaBar criteria={sample.criteria} showLegend />
        </div>

        <ul className="hv-result-reasons">
          {sample.reasons.map((r, i) => (
            <li key={r} data-kind="pass" style={{ animationDelay: `${1.9 + i * 0.2}s` }}>
              {r}
            </li>
          ))}
          {sample.risks.map((r) => (
            <li key={r} data-kind="fail" style={{ animationDelay: "2.3s" }}>
              {r}
            </li>
          ))}
        </ul>

        {stamp}
      </div>

      <Link href="/screener/buffett" className="hv-result-cta">
        내 기준 만들기 →
      </Link>
    </section>
  );
}
