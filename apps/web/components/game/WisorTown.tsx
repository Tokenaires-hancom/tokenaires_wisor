"use client";

import type { CSSProperties } from "react";
import Mascot, { type MascotState } from "@/components/game/Mascot";
import { xpTotal, levelFor, masterProgress, type ProgressLike } from "@/lib/gamification.ts";
import { townLastCompletedPlot, townMasterLabel, townMascotPlot, townScenery } from "@/lib/townScene.ts";
import "./town.css";

/** 대가별 건물 색(온-브랜드 다채색). masterProgress는 MASTERS 순서로 온다. */
const ACCENTS = ["#7b2d3a", "#b8863b", "#9c5a3c", "#4a6d72", "#7a5c8a", "#6b7b52", "#a15a1e"];

/** 내 투자 마을 — 배울수록 자란다.
 *  대가 7명 = 건물 7채. 각 건물은 그 대가의 완료 챕터(0~5)만큼 층이 오른다.
 *  성장 통화는 학습(완료 챕터)뿐 — 가상 현금·수익 게임화 없음(대원칙). */
export default function WisorTown({
  progress,
  highlightId,
  mascot = "idle",
}: {
  progress: ProgressLike;
  highlightId?: string;
  mascot?: MascotState;
}) {
  const rows = masterProgress(progress);
  const lvl = levelFor(xpTotal(progress)).level;
  const builtCount = rows.filter((r) => r.complete).length;
  const scenery = townScenery(lvl);
  const highlightIndex = highlightId ? rows.findIndex((r) => r.masterId === highlightId) : -1;
  const coinAt = highlightIndex >= 0 ? highlightIndex : townMascotPlot(rows, progress.lessonsDone);
  const fireworkAt = townLastCompletedPlot(rows, progress.lessonsDone);

  return (
    <section className="town" aria-label="내 투자 마을">
      <div className="town-head">
        <p className="eyebrow">내 투자 마을</p>
        <p className="town-sub">
          배울수록 마을이 자랍니다 · <strong>Lv {lvl}</strong> · 완공 {builtCount} / {rows.length}
        </p>
      </div>

      <div
        className="town-scene"
        data-path={scenery.path ? "true" : undefined}
        data-celebrate={mascot === "celebrate" ? "true" : undefined}
      >
        <span className="town-sun" aria-hidden="true" />
        <span className="town-cloud town-cloud-a" aria-hidden="true" />
        <span className="town-cloud town-cloud-b" aria-hidden="true" />
        <span className="town-cloud town-cloud-c" aria-hidden="true" />
        <span className="town-bird town-bird-a" aria-hidden="true" />
        <span className="town-bird town-bird-b" aria-hidden="true" />
        <span className="town-bird town-bird-c" aria-hidden="true" />
        {mascot === "celebrate" &&
          Array.from({ length: 14 }).map((_, c) => (
            <span key={c} className="town-confetti" data-i={c} aria-hidden="true" />
          ))}
        {scenery.bench && <span className="town-bench" aria-hidden="true" />}
        <div className="town-row">
          {rows.map((r, i) => {
            const shortName = townMasterLabel(r.masterId);
            return (
              <div
                className="town-plot"
                key={r.masterId}
                aria-label={`${r.name} ${r.done}/${r.total}장`}
                data-complete={r.complete}
                data-highlight={highlightId === r.masterId ? "true" : undefined}
                data-coin={i === coinAt ? "true" : undefined}
                style={{ "--accent": ACCENTS[i % ACCENTS.length] } as CSSProperties}
              >
                {highlightId === r.masterId &&
                  Array.from({ length: 10 }).map((_, s) => (
                    <span key={s} className="town-burst" data-i={s} aria-hidden="true" />
                  ))}
                {i === fireworkAt &&
                  Array.from({ length: 11 }).map((_, s) => (
                    <span key={s} className="town-firework" data-i={s} aria-hidden="true" />
                  ))}
                <div className="town-plot-body">
                  {i === coinAt && (
                    <span className="town-coin" data-celebrate={mascot === "celebrate" ? "true" : undefined}>
                      <Mascot state={mascot} />
                    </span>
                  )}
                  <div className="town-building">
                    {r.complete && <span className="town-flag" aria-hidden="true" />}
                    {r.done === 0 ? (
                      <span className="town-lot" aria-hidden="true" />
                    ) : (
                      <>
                        {Array.from({ length: r.done }).map((_, f) => (
                          <span
                            key={f}
                            className="town-floor"
                            data-new={highlightId === r.masterId && f === r.done - 1 ? "true" : undefined}
                            style={{ animationDelay: `${f * 70}ms` }}
                          />
                        ))}
                        <span className="town-roof" aria-hidden="true" />
                      </>
                    )}
                  </div>
                  <span className="town-name">{shortName}</span>
                  <span className="town-count">
                    {r.done}/{r.total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
