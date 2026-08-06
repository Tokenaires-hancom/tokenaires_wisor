"use client";

import { FormEvent, useState } from "react";

type LiveStock = {
  symbol: string;
  name: string;
  englishName: string | null;
  market: string;
  securityType: string;
  status: string;
  currency: string;
  lastPrice: string;
  priceTimestamp: string;
};

function formatPrice(value: string, currency: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(amount);
}

export default function StockLookup() {
  const [symbol, setSymbol] = useState("");
  const [stock, setStock] = useState<LiveStock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = symbol.trim();
    if (!query) return;

    setLoading(true);
    setError(null);
    setStock(null);
    try {
      const response = await fetch(`/api/stocks/lookup?symbol=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { stock?: LiveStock; error?: string };
      if (!response.ok || !payload.stock) {
        throw new Error(payload.error ?? "종목 정보를 불러오지 못했습니다.");
      }
      setStock(payload.stock);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "종목 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card live-stock-lookup" aria-labelledby="live-stock-title">
      <p className="eyebrow">토스증권 실시간 데이터</p>
      <h2 id="live-stock-title" className="sub">실제 종목 확인</h2>
      <p className="live-stock-help">
        국내 종목코드(예: 005930)나 미국 티커(예: AAPL)를 입력하면 현재 종목 정보와 가격을 확인합니다.
        현재가만 실데이터이며 위 스타일 결과에는 반영되지 않습니다.
      </p>
      <form className="stock-lookup-form" onSubmit={submit}>
        <label className="field stock-lookup-field">
          <span>종목코드 또는 티커</span>
          <input
            type="text"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value)}
            placeholder="005930 또는 AAPL"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={20}
            aria-describedby="stock-lookup-status"
          />
        </label>
        <button className="btn" type="submit" disabled={loading || !symbol.trim()}>
          {loading ? "조회 중…" : "조회하기"}
        </button>
      </form>

      <div id="stock-lookup-status" aria-live="polite" aria-busy={loading}>
        {error && <p className="stock-lookup-error">{error}</p>}
        {stock && (
          <div className="live-stock-result">
            <div>
              <strong className="stock-name">{stock.name}</strong>
              <span className="stock-ticker">{stock.symbol} · {stock.market}</span>
              {stock.englishName && <p className="live-stock-english">{stock.englishName}</p>}
            </div>
            <div className="live-stock-price">
              <strong>{formatPrice(stock.lastPrice, stock.currency)}</strong>
              <span>{new Date(stock.priceTimestamp).toLocaleString("ko-KR")} 기준</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
