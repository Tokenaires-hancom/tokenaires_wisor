import assert from "node:assert/strict";
import test from "node:test";
import { financialRange } from "./financialRange.ts";
import type { Company } from "./scores.types.ts";

function company(ticker: string, financial: string): Company {
  return {
    ticker,
    name: ticker,
    sector: "테스트",
    price: 10,
    marketCap: 100,
    asOf: { price: "2026-08-05", financial },
    metrics: {},
    scores: {},
  } as Company;
}

test("가장 이른 날과 가장 늦은 날을 양 끝으로 잡는다", () => {
  const range = financialRange(
    [company("A", "2025-12-31"), company("B", "2025-03-29"), company("C", "2026-07-03")],
    "2000-01-01",
  );
  assert.deepEqual(range, { from: "2025-03-29", to: "2026-07-03" });
});

test("입력 순서가 뒤섞여도 결과가 같다", () => {
  const dates = ["2026-07-03", "2025-03-29", "2025-12-31"];
  const forward = financialRange(dates.map((d, i) => company(`F${i}`, d)), "2000-01-01");
  const backward = financialRange(
    [...dates].reverse().map((d, i) => company(`B${i}`, d)),
    "2000-01-01",
  );
  assert.deepEqual(forward, backward);
});

test("종목이 하나면 양 끝이 같은 날이다", () => {
  const range = financialRange([company("A", "2025-12-31")], "2000-01-01");
  assert.deepEqual(range, { from: "2025-12-31", to: "2025-12-31" });
});

test("종목이 없으면 fallback을 양쪽에 쓴다", () => {
  // 화면은 이 값을 날짜로 그대로 내보낸다. 빈 문자열이 나가면 안 된다.
  const range = financialRange([], "2026-01-15");
  assert.deepEqual(range, { from: "2026-01-15", to: "2026-01-15" });
});

test("건네받은 배열을 뒤섞지 않는다", () => {
  // scores.ts가 DATA.companies를 그대로 넘긴다. 여기서 정렬해버리면
  // 종목 목록 순서가 통째로 바뀐다.
  const companies = [company("A", "2026-07-03"), company("B", "2025-03-29")];
  financialRange(companies, "2000-01-01");
  assert.deepEqual(
    companies.map((c) => c.ticker),
    ["A", "B"],
  );
});
