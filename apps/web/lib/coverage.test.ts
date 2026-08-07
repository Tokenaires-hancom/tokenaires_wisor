import assert from "node:assert/strict";
import test from "node:test";
import { styleCoverage } from "./coverage.ts";
import type { Company, StyleMeta } from "./scores.types.ts";

function style(id: string, codes: string[]): StyleMeta {
  return {
    id,
    name: id,
    modelVersion: `${id} 1.0`,
    criteria: codes.map((code) => ({ code, label: `${code} 라벨`, weight: 1, detail: "" })),
  };
}

function company(ticker: string, scores: Record<string, unknown>, scorable?: boolean): Company {
  return {
    ticker,
    name: ticker,
    sector: "테스트",
    price: 10,
    marketCap: 100,
    asOf: { price: "2026-08-05", financial: "2025-12-31" },
    metrics: {},
    scores,
    ...(scorable === false ? { scorable: false } : {}),
  } as Company;
}

function scoreOf(value: number | null, unknownCodes: string[] = []) {
  return {
    score: value,
    criteria: unknownCodes.map((code) => ({ code, status: "unknown" })),
  };
}

const STYLES = [style("buffett", ["A", "B", "C", "D", "E", "F", "G", "H"]), style("lynch", ["P", "Q", "R", "S", "T"])];

test("기준이 8개면 2개까지, 5개면 1개까지 비어도 점수를 만든다", () => {
  // 판정 불가가 전체의 1/4을 넘으면 점수를 만들지 않는다는 규칙에서 나오는 수다.
  const { byStyle } = styleCoverage([], STYLES);

  assert.equal(byStyle.find((s) => s.styleId === "buffett")?.allowedUnknown, 2);
  assert.equal(byStyle.find((s) => s.styleId === "lynch")?.allowedUnknown, 1);
});

test("점수를 낸 종목과 정보 부족을 센다", () => {
  const companies = [
    company("A", { buffett: scoreOf(70), lynch: scoreOf(50) }),
    company("B", { buffett: scoreOf(80), lynch: scoreOf(null, ["P"]) }),
  ];

  const { byStyle } = styleCoverage(companies, STYLES);

  assert.equal(byStyle.find((s) => s.styleId === "buffett")?.scored, 2);
  assert.equal(byStyle.find((s) => s.styleId === "lynch")?.scored, 1);
  assert.equal(byStyle.find((s) => s.styleId === "lynch")?.unscored, 1);
});

test("업종 때문에 판정하지 않은 종목은 정보 부족에 넣지 않는다", () => {
  const companies = [
    company("A", { buffett: scoreOf(70), lynch: scoreOf(60) }),
    company("BANK", { buffett: scoreOf(null), lynch: scoreOf(null) }, false),
  ];

  const { universe, unscorable, byStyle } = styleCoverage(companies, STYLES);

  assert.equal(universe, 2);
  assert.equal(unscorable, 1);
  assert.equal(byStyle.find((s) => s.styleId === "buffett")?.unscored, 0);
});

test("가장 많이 비었던 기준을 이름과 함께 돌려준다", () => {
  const companies = [
    company("A", { buffett: scoreOf(70), lynch: scoreOf(null, ["P", "Q"]) }),
    company("B", { buffett: scoreOf(70), lynch: scoreOf(null, ["P"]) }),
  ];

  const top = styleCoverage(companies, STYLES).byStyle.find((s) => s.styleId === "lynch")?.topMissing;

  assert.deepEqual(top?.[0], { code: "P", label: "P 라벨", count: 2 });
  assert.equal(top?.[1].code, "Q");
});

test("점수를 낸 종목의 판정 불가 기준은 세지 않는다", () => {
  // 점수가 나온 종목에도 unknown은 있다. 그건 '이 스타일이 종목을 놓친 이유'가 아니다.
  const companies = [company("A", { buffett: scoreOf(70, ["A"]), lynch: scoreOf(60) })];

  assert.deepEqual(styleCoverage(companies, STYLES).byStyle[0].topMissing, []);
});
