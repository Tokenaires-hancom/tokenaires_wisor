import assert from "node:assert/strict";
import test from "node:test";
import { rank } from "./ranking.ts";
import type { Company } from "./scores.types.ts";

function company(over: Partial<Company> & { ticker: string }): Company {
  return {
    name: over.ticker,
    sector: "테스트",
    price: 10,
    marketCap: 1000,
    asOf: { price: "2026-08-05", financial: "2025-12-31" },
    metrics: {},
    scores: {},
    ...over,
  } as Company;
}

function scored(ticker: string, score: number | null) {
  return company({
    ticker,
    scores: { buffett: { score } as Company["scores"][string] },
  });
}

test("점수가 있는 종목만 순위에 넣는다", () => {
  const { scored: ranked } = rank([scored("A", 70), scored("B", 90)], "buffett");
  assert.deepEqual(ranked.map((c) => c.ticker), ["B", "A"]);
});

test("데이터가 모자란 종목과 업종 때문에 판정하지 않은 종목을 따로 묶는다", () => {
  const bank = company({
    ticker: "BANK",
    scorable: false,
    unscorableReason: "은행은 판정하지 않습니다.",
    scores: { buffett: { score: null } as Company["scores"][string] },
  });

  const result = rank([scored("A", 70), scored("THIN", null), bank], "buffett");

  assert.deepEqual(result.scored.map((c) => c.ticker), ["A"]);
  assert.deepEqual(result.unscored.map((c) => c.ticker), ["THIN"]);
  assert.deepEqual(result.unscorable.map((c) => c.ticker), ["BANK"]);
});

test("업종 때문에 빠진 종목은 데이터 부족으로 세지 않는다", () => {
  // 화면 문구가 '판정에 필요한 데이터가 모자라'이므로, 섞이면 거짓말이 된다.
  const bank = company({
    ticker: "BANK",
    scorable: false,
    scores: { buffett: { score: null } as Company["scores"][string] },
  });

  assert.equal(rank([bank], "buffett").unscored.length, 0);
});

test("스타일 항목이 아예 없는 종목도 정보 부족으로 본다", () => {
  const result = rank([company({ ticker: "NONE" })], "buffett");
  assert.deepEqual(result.unscored.map((c) => c.ticker), ["NONE"]);
});
