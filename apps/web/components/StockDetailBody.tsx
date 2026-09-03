"use client";

import { useEffect, useState, type ReactNode } from "react";
import StockLenses from "@/components/StockLenses";
import WatchButton from "@/components/WatchButton";
import { FinancialTerm } from "@/components/FinancialTerm";
import { money } from "@/lib/format";
import type { Company } from "@/lib/scores.types";

/** 종목 상세 본문. `/stocks/[ticker]` 페이지와 스크리너 오른쪽 칸이 둘 다 이것을
 *  부른다. 이 컴포넌트가 클라이언트인 이유는 왼쪽 대가 칸에서 고른 철학을
 *  기억해야 해서다 — `lib/scores`(서버 전용)는 여기서 직접 못 부른다. 시가총액
 *  순위는 `marketCapRanks()`로, `DataStamp`·`SampleDataFlag`는 이미 렌더링된
 *  결과를 서버 쪽 호출자가 넘긴다. `components/home/HomeResult.tsx`가 같은
 *  이유로 같은 방식을 쓴다. */
export default function StockDetailBody({
  company,
  marketCapRank,
  marketCapUniverseSize,
  initialStyle,
  stamps,
  sampleFlag,
}: {
  company: Company;
  marketCapRank: number | undefined;
  marketCapUniverseSize: number;
  /** 상단 철학 탭(또는 `/stocks` 페이지의 `?style=`)이 고른 기본 철학. */
  initialStyle: string;
  /** 이 종목이 가진 철학 id → 그 철학의 DataStamp. 대가를 바꿔도 진짜 재무
   *  기준일·모델 버전이 따라오도록 철학별로 미리 렌더링해 받는다. */
  stamps: Record<string, ReactNode>;
  sampleFlag: ReactNode;
}) {
  const [styleId, setStyleId] = useState(initialStyle);

  /* 다른 종목을 고르면 대가 선택도 상단 탭이 고른 철학으로 되돌아간다 —
     앞 종목에서 고른 대가를 다음 종목까지 들고 다니지 않는다. */
  useEffect(() => {
    setStyleId(initialStyle);
  }, [company.ticker, initialStyle]);

  return (
    <>
      <div style={{ marginTop: "1rem", marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 400, margin: 0 }}>{company.name}</h1>
          <span style={{ alignSelf: "center" }}>
            <WatchButton ticker={company.ticker} />
          </span>
          <p className="mono" style={{ color: "var(--ink-faint)", margin: 0 }}>
            {company.ticker} · {company.sector}
          </p>
        </div>
        <div className="stock-market-strip" aria-label="종목 시장 정보">
          <div>
            <span>종가</span>
            <strong>{company.price.toFixed(2)} 달러</strong>
          </div>
          <div>
            <span><FinancialTerm term="marketCap">시가총액</FinancialTerm></span>
            <strong>{money(company.marketCap)}</strong>
          </div>
          <div>
            <span><FinancialTerm term="marketCap">시가총액</FinancialTerm> 순위</span>
            <strong>
              {marketCapRank ? `${marketCapRank}위` : "정보 없음"}
              {marketCapRank && <small> / {marketCapUniverseSize}종목</small>}
            </strong>
          </div>
        </div>
        {stamps[styleId]}
      </div>

      {sampleFlag}

      <div style={{ marginTop: "1.5rem" }}>
        <StockLenses
          company={company}
          initialStyle={styleId}
          preferredStyleId={initialStyle}
          onChangeStyle={setStyleId}
        />
      </div>
    </>
  );
}
