"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import CriteriaBar from "@/components/CriteriaBar";
import WatchButton from "@/components/WatchButton";
import { PAGE_SIZE, pageCount, pageSlice } from "@/lib/paginate";
import type { Company } from "@/lib/scores.types";

/** 로고 파일이 아직 없는 종목은 티커 전체를 같은 크기 칸에 넣는다.
 *  앞 몇 글자만 뽑으면 구별이 안 된다 — 1글자 티커가 8개고(A·C·F·T·V 등)
 *  AM으로 시작하는 종목만 9개다(AMAT·AMCR·AMD·AME·AMGN·AMP·AMT·AMZN).
 *  칸 크기는 파일이 있든 없든 같다. 있을 때만 자리를 만들면 줄마다 이름
 *  시작점이 달라져 목록이 들쭉날쭉해진다. */
function StockLogo({ ticker }: { ticker: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [missing, setMissing] = useState(false);

  /* 파일이 없으면 이미지는 하이드레이션 전에 이미 실패해 있다. 그때의 onError는
     React가 받을 수 없으므로, 붙고 나서 한 번 직접 확인한다. onError는 붙은 뒤에
     실패하는 경우를 받는다. */
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setMissing(true);
  }, []);

  if (missing) return <span className="stock-logo">{ticker}</span>;

  return (
    <span className="stock-logo">
      <img
        ref={ref}
        src={`/logos/${ticker}.png`}
        alt=""
        width={28}
        height={28}
        onError={() => setMissing(true)}
      />
    </span>
  );
}

export default function ScreenerCompanies({
  companies,
  style,
  selectedTicker,
  onSelect,
}: {
  /** 판정 · 정보 부족 · 판정 제외 세 묶음 중 지금 목록 머리에서 고른 묶음.
   *  세 묶음은 종목마다 `scores[style]`이 있는지·score가 null인지가 다르다
   *  (아래 렌더에서 갈라 쓴다) — 묶음이 뭐냐로 컴포넌트를 나누지 않는다. */
  companies: Company[];
  style: string;
  /** 지금 오른쪽 칸에 뜬 종목. `aria-current`로만 표시한다 — 목록 자체는 이 값으로
   *  걸러지거나 움직이지 않는다. */
  selectedTicker: string | null;
  /** 줄을 누르면 페이지를 떠나지 않고 이 콜백만 부른다. 어느 종목을 보여줄지는
   *  부모(`ScreenerSplit`)가 정한다 — 목록은 목록 그리기만 맡는다. */
  onSelect: (ticker: string) => void;
}) {
  const [page, setPage] = useState(1);
  const last = pageCount(companies.length);
  const visible = pageSlice(companies, page);

  return (
    <>
      <div
        className="stock-row-list"
        /* CSS의 repeat()는 반복 횟수 자리에 var()를 못 받는다(스펙 제약,
           브라우저가 조용히 grid-template-rows 전체를 무효화하고 auto로
           되돌린다) — PAGE_SIZE를 아는 이 자리에서 문자열을 직접 만든다.
           숫자를 두 파일에 손으로 맞출 필요가 없다. */
        style={{ gridTemplateRows: `repeat(${PAGE_SIZE}, minmax(min-content, 1fr))` } as CSSProperties}
      >
        {visible.map((c) => {
          const s = c.scores[style];
          return (
            <div
              key={c.ticker}
              className="stock-row"
              data-current={selectedTicker === c.ticker ? "true" : undefined}
            >
              <button
                type="button"
                className="stock-row-select"
                aria-current={selectedTicker === c.ticker ? "true" : undefined}
                onClick={() => onSelect(c.ticker)}
              >
                <StockLogo ticker={c.ticker} />
                <span className="stock-name" title={c.name}>{c.name}</span>
                {s ? (
                  <>
                    <span className="stock-row-bar">
                      <CriteriaBar criteria={s.criteria} size="sm" />
                    </span>
                    <span className="stock-score">
                      {s.rank !== undefined ? `#${s.rank}` : s.score ?? s.dataConfidence}
                    </span>
                  </>
                ) : (
                  /* 정보 부족·판정 제외 종목 중에는 이 철학에서 scores[style] 자체가
                     없는 경우가 있다(lib/ranking.ts). 판정한 기준이 없으니 막대를
                     그릴 값이 없다 — 자리는 비워 둔다(그리드 칸 수를 맞춘다).
                     사유 문장(unscorableReason)은 40자를 넘어 이 좁은 칸에 못 들어가서
                     여기서는 안 쓴다. 전체 문장은 줄을 눌러 오른쪽 칸(BusinessLens)에서
                     읽는다. */
                  <>
                    <span className="stock-row-bar" />
                    <span className="stock-score stock-score-reason">
                      {c.unscorableReason ? "판정 제외" : "정보 부족"}
                    </span>
                  </>
                )}
              </button>
              <WatchButton ticker={c.ticker} size="sm" />
            </div>
          );
        })}
      </div>

      <div className="stock-pager">
        <button
          type="button"
          className="pager-arrow"
          aria-label={`이전 ${PAGE_SIZE}개`}
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          ◀
        </button>
        {/* 넘어간 사실이 화면을 못 보는 사람에게도 읽히도록 이 자리만 낭독한다 */}
        <span className="pager-count mono" aria-live="polite">
          {page} / {last}
        </span>
        <button
          type="button"
          className="pager-arrow"
          aria-label={`다음 ${PAGE_SIZE}개`}
          disabled={page >= last}
          onClick={() => setPage((p) => p + 1)}
        >
          ▶
        </button>
      </div>
    </>
  );
}
