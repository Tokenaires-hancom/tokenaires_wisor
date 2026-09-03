"use client";

import { useEffect, useState, type ReactNode } from "react";
import ScreenerCompanies from "@/components/ScreenerCompanies";
import StockDetailBody from "@/components/StockDetailBody";
import { filterCompaniesByQuery } from "@/lib/searchCompanies";
import { getWatchlist } from "@/lib/store";
import type { Company } from "@/lib/scores.types";

type Group = "scored" | "unscored" | "unscorable" | "watchlist";

const GROUPS: Group[] = ["scored", "unscored", "unscorable", "watchlist"];

const GROUP_LABEL: Record<Group, string> = {
  scored: "판정",
  unscored: "정보 부족",
  unscorable: "판정 제외",
  watchlist: "관심종목",
};

/** 종목 찾기의 왼쪽 목록 · 오른쪽 상세를 하나의 상태로 묶는다. 페이지를 떠나지
 *  않고 오른쪽만 바뀐다 — 목록에서 종목을 고르면 이 컴포넌트 안 state만 바뀐다.
 *
 *  `DataStamp`는 `lib/scores`(서버 전용)를 읽으므로 이 클라이언트 컴포넌트가
 *  직접 부르지 못한다. 서버(`page.tsx`)가 판정·정보 부족·판정 제외 종목마다,
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

     목록 머리에서 고른 묶음(판정/정보 부족/판정 제외)도 같은 이유로 여기 둔다 —
     철학 탭을 바꾸면 세 묶음의 개수 자체가 달라지므로(버핏은 정보 부족 0, 그린블랫은
     67) 탭을 넘어 들고 다닐 이유가 없다. */
  const [group, setGroup] = useState<Group>("scored");
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  /* 관심종목은 이 종목찾기 화면이 아니라 store.ts(→ Supabase 교체 지점)에
     있는 사용자 데이터라 null(아직 못 읽음)로 시작해, 다 읽으면 그때 배열로
     바뀐다. 로딩 중에는 개수 0으로 보여 다른 빈 묶음과 똑같이 비활성화된다 —
     번쩍이는 게 없다는 뜻은 아니지만, 별도 "불러오는 중" 문구를 더하기엔
     이 화면에 그 정도로 오래 걸리지 않는다. */
  const [watchlist, setWatchlist] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    void getWatchlist().then((tickers) => {
      if (alive) setWatchlist(tickers);
    });
    return () => {
      alive = false;
    };
  }, []);
  /* 판정 제외 종목을 고른 채로 [판정] 묶음으로 돌아가도(또는 그 반대) 오른쪽
     칸은 그대로 있어야 한다 — 묶음 전환은 왼쪽 목록만 바꾸는 필터이지 오른쪽의
     선택을 지우는 동작이 아니다. 그래서 세 배열을 다 뒤진다. */
  const selected = selectedTicker
    ? scored.find((c) => c.ticker === selectedTicker) ??
      unscored.find((c) => c.ticker === selectedTicker) ??
      unscorable.find((c) => c.ticker === selectedTicker)
    : undefined;

  const watchlistSet = new Set(watchlist ?? []);
  const watched = [...scored, ...unscored, ...unscorable].filter((c) => watchlistSet.has(c.ticker));

  const GROUP_COMPANIES: Record<Group, Company[]> = {
    scored,
    unscored,
    unscorable,
    watchlist: watched,
  };

  /* 검색어가 있으면 묶음 탭과 무관하게 세 묶음을 합쳐 찾는다 — "액센츄어"가
     [정보 부족] 묶음에 있어도 지금 [판정] 탭을 보고 있으면 찾을 수 있어야
     한다. 검색어를 지우면 원래 보고 있던 묶음으로 그대로 돌아간다. */
  const searching = query.trim().length > 0;
  const visible = searching
    ? filterCompaniesByQuery([...scored, ...unscored, ...unscorable], query)
    : GROUP_COMPANIES[group];

  return (
    <div className="screener-split">
      <div className="screener-split-list">
        <div className="screener-list-head">
          <div className="screener-group-toggle" role="tablist" aria-label="목록 묶음">
            {GROUPS.map((g) => {
              const count = GROUP_COMPANIES[g].length;
              return (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  className="screener-group-btn"
                  aria-selected={group === g}
                  disabled={count === 0 || searching}
                  onClick={() => setGroup(g)}
                >
                  {GROUP_LABEL[g]} {count}
                </button>
              );
            })}
          </div>
          {/* 묶음 탭이 셋에서 넷(관심종목 추가)으로 늘면서 검색창과 한 줄에
             같이 두기엔 420px 목록 칸이 좁다. 검색창을 아래 줄로 내렸다. */}
          <div className="screener-search">
            <input
              type="search"
              className="screener-search-input"
              aria-label="종목 검색"
              placeholder="회사 이름 또는 티커"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {searching && (
              <button
                type="button"
                className="screener-search-clear"
                aria-label="검색어 지우기"
                onClick={() => setQuery("")}
              >
                ×
              </button>
            )}
          </div>
        </div>
        {/* .screener-list-head는 이제 margin-bottom이 없다(첫 종목 줄과의 간격은
           .stock-row 자신의 padding-top만으로 충분하다 — 위 스타일 주석 참고).
           예시 데이터 배지가 뜰 때만 그 자리에 여백이 따로 필요하다. */}
        {sampleFlag && <div style={{ marginTop: "0.5rem" }}>{sampleFlag}</div>}
        {searching && visible.length === 0 ? (
          <p className="screener-search-empty">
            &lsquo;{query.trim()}&rsquo;와 일치하는 종목이 없습니다. 회사 이름이나 티커로 다시 찾아보세요.
          </p>
        ) : (
          <ScreenerCompanies
            /* 묶음이나 검색어가 바뀌면 페이지를 1로 되돌린다. ScreenerCompanies 안의
               페이지 상태는 이 컴포넌트가 모른다 — key를 바꿔 통째로 다시 만드는 편이
               내부 상태를 이 컴포넌트로 끌어올리는 것보다 간단하다. */
            key={searching ? `search:${query}` : group}
            companies={visible}
            style={style}
            selectedTicker={selectedTicker}
            onSelect={setSelectedTicker}
          />
        )}
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
