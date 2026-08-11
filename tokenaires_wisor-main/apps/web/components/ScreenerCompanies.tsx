"use client";

import Link from "next/link";
import { useState } from "react";
import CriteriaBar from "@/components/CriteriaBar";
import type { Company } from "@/lib/scores.types";

const PAGE_SIZE = 50;

export default function ScreenerCompanies({ scored, style }: { scored: Company[]; style: string }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = scored.slice(0, visibleCount);

  return (
    <>
      <div>
        {visible.map((c, i) => {
          const s = c.scores[style];
          return (
            <Link key={c.ticker} href={`/stocks/${c.ticker}?style=${style}`} className="stock-row">
              <span className="stock-rank">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className="stock-name">{c.name}</span>
                <span className="stock-ticker">{c.ticker} · {c.sector}</span>
                <div style={{ marginTop: "0.55rem", maxWidth: "420px" }}>
                  <CriteriaBar criteria={s.criteria} size="sm" />
                </div>
                <ul className="reason-list">
                  {s.reasons.slice(0, 2).map((r, ri) => (
                    <li key={ri} data-kind="pass">
                      {r}
                    </li>
                  ))}
                  {s.risks.slice(0, 1).map((r, ri) => (
                    <li key={ri} data-kind="fail">
                      {r}
                    </li>
                  ))}
                </ul>
              </span>
              <span className="stock-score">
                <span className="score-value">{s.rank !== undefined ? `#${s.rank}` : s.score}</span>
                <div className="score-of">
                  {s.rankComponents
                    ? `질 ${s.rankComponents.quality}위 · 가격 ${s.rankComponents.value}위`
                    : `${s.passed}/${s.total} 기준`}
                </div>
              </span>
            </Link>
          );
        })}
      </div>

      {visibleCount < scored.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "1.5rem" }}>
          <button
            type="button"
            className="btn"
            onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, scored.length))}
          >
            더보기 {Math.min(PAGE_SIZE, scored.length - visibleCount)}개
          </button>
        </div>
      )}
    </>
  );
}
