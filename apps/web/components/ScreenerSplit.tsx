"use client";

import { useState, type ReactNode } from "react";
import ScreenerCompanies from "@/components/ScreenerCompanies";
import StockDetailBody from "@/components/StockDetailBody";
import type { Company } from "@/lib/scores.types";

type Group = "scored" | "unscored" | "unscorable";

const GROUP_LABEL: Record<Group, string> = {
  scored: "채점",
  unscored: "정보 부족",
  unscorable: "판정 제외",
};

/** 종목 찾기의 왼쪽 목록 · 오른쪽 상세를 하나의 상태로 묶는다. 페이지를 떠나지
 *  않고 오른쪽만 바뀐다 — 목록에서 종목을 고르면 이 컴포넌트 안 state만 바뀐다.
 *
 *  `DataStamp`는 `lib/scores`(서버 전용)를 읽으므로 이 클라이언트 컴포넌트가
 *  직접 부르지 못한다. 서버(`page.tsx`)가 채점·정보 부족·판정 제외 종목마다,
 *  그 종목이 가진 철학마다 미리 렌더링해 `stamps`로 넘긴다 —
 *  `components/StockDetailBody.tsx`의 `stamps` prop과 같은 이유, 같은 방식이다.
 *  `sampleFlag`와 `emptyState`(=`CriteriaLegend`)도 같은 이유로 서버가 미리
 *  렌더링해 넘긴다. */
export default function ScreenerSplit({
  scored,
  unscored,
  unscorable,
  style,
  stamps,
  sampleFlag,
  marketCapRanks,
  marketCapUniverseSize,
  emptyState,
}: {
  scored: Company[];
  unscored: Company[];
  unscorable: Company[];
  style: string;
  /** 종목 티커 → 그 종목이 가진 철학 id → 그 철학의 DataStamp. 상세 칸에서
   *  대가 얼굴을 눌러 철학을 바꿔도(StockDetailBody) 진짜 기준일이 따라오게
   *  철학별로 미리 다 만들어 둔다. */
  stamps: Record<string, Record<string, ReactNode>>;
  /** 예시 데이터 배지. 종목을 골랐든 아니든 항상 보이도록 오른쪽 칸이 아니라
   *  왼쪽 목록 머리에 둔다. */
  sampleFlag: ReactNode;
  marketCapRanks: Record<string, number>;
  marketCapUniverseSize: number;
  emptyState: ReactNode;
}) {
  /* 선택한 종목은 이 컴포넌트 안 state다 — 철학 탭을 누르면 [style]이 바뀌는
     라우트 이동이라 이 컴포넌트가 통째로 다시 그려지고, 고른 종목도 함께
     초기화돼 종목 선택 전 기본 화면(emptyState)으로 돌아간다. 탭을 넘어서까지
     들고 다니지 않는다.

     목록 머리에서 고른 묶음(채점/정보 부족/판정 제외)도 같은 이유로 여기 둔다 —
     철학 탭을 바꾸면 세 묶음의 개수 자체가 달라지므로(버핏은 정보 부족 0, 그린블랫은
     67) 탭을 넘어 들고 다닐 이유가 없다. */
  const [group, setGroup] = useState<Group>("scored");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  /* 판정 제외 종목을 고른 채로 [채점] 묶음으로 돌아가도(또는 그 반대) 오른쪽
     칸은 그대로 있어야 한다 — 묶음 전환은 왼쪽 목록만 바꾸는 필터이지 오른쪽의
     선택을 지우는 동작이 아니다. 그래서 세 배열을 다 뒤진다. */
  const selected = selectedTicker
    ? scored.find((c) => c.ticker === selectedTicker) ??
      unscored.find((c) => c.ticker === selectedTicker) ??
      unscorable.find((c) => c.ticker === selectedTicker)
    : undefined;

  const visible = group === "scored" ? scored : group === "unscored" ? unscored : unscorable;

  return (
    <div className="screener-split">
      <div className="screener-split-list">
        <div className="screener-group-toggle" role="tablist" aria-label="목록 묶음">
          {(["scored", "unscored", "unscorable"] as const).map((g) => {
            const count = g === "scored" ? scored.length : g === "unscored" ? unscored.length : unscorable.length;
            return (
              <button
                key={g}
                type="button"
                role="tab"
                className="screener-group-btn"
                aria-selected={group === g}
                disabled={count === 0}
                onClick={() => setGroup(g)}
              >
                {GROUP_LABEL[g]} {count}
              </button>
            );
          })}
        </div>
        {sampleFlag}
        <ScreenerCompanies
          /* 묶음이 바뀌면 페이지를 1로 되돌린다. ScreenerCompanies 안의 페이지
             상태는 이 컴포넌트가 모른다 — key를 바꿔 통째로 다시 만드는 편이
             내부 상태를 이 컴포넌트로 끌어올리는 것보다 간단하다. */
          key={group}
          companies={visible}
          style={style}
          selectedTicker={selectedTicker}
          onSelect={setSelectedTicker}
        />
      </div>
      <div className="screener-split-detail">
        {selected ? (
          <StockDetailBody
            company={selected}
            marketCapRank={marketCapRanks[selected.ticker]}
            marketCapUniverseSize={marketCapUniverseSize}
            initialStyle={style}
            stamps={stamps[selected.ticker]}
            /* 배지는 이미 왼쪽 목록 머리에 있다. 여기서 또 그리면 종목을 고른
               순간 같은 배지가 한 화면에 두 번 뜬다. */
            sampleFlag={null}
          />
        ) : (
          <div className="screener-empty-state">{emptyState}</div>
        )}
      </div>
    </div>
  );
}
