import assert from "node:assert/strict";
import test from "node:test";
import { filterCompaniesByQuery } from "./searchCompanies.ts";
import type { Company } from "./scores.types.ts";

function company(ticker: string, name: string): Company {
  return {
    ticker,
    name,
    sector: "테스트",
    price: 10,
    marketCap: 1000,
    asOf: { price: "2026-08-05", financial: "2025-12-31" },
    metrics: {},
    scores: {},
  } as Company;
}

const ACCENTURE = company("ACN", "액센츄어");
const APPLE = company("AAPL", "애플");

test("빈 검색어는 목록을 그대로 돌려준다", () => {
  const result = filterCompaniesByQuery([ACCENTURE, APPLE], "   ");
  assert.deepEqual(result, [ACCENTURE, APPLE]);
});

test("회사 이름으로 찾는다", () => {
  const result = filterCompaniesByQuery([ACCENTURE, APPLE], "액센츄어");
  assert.deepEqual(result, [ACCENTURE]);
});

test("티커로 찾는다", () => {
  const result = filterCompaniesByQuery([ACCENTURE, APPLE], "aapl");
  assert.deepEqual(result, [APPLE]);
});

test("대소문자를 구분하지 않는다", () => {
  const result = filterCompaniesByQuery([ACCENTURE, APPLE], "AcN");
  assert.deepEqual(result, [ACCENTURE]);
});

test("일치하는 종목이 없으면 빈 배열을 돌려준다", () => {
  const result = filterCompaniesByQuery([ACCENTURE, APPLE], "테슬라");
  assert.deepEqual(result, []);
});

test("영어 회사명으로도 찾는다", () => {
  const result = filterCompaniesByQuery([ACCENTURE, APPLE], "apple");
  assert.deepEqual(result, [APPLE]);
});

test("영어 회사명 목록에 없는 티커는 에러 없이 넘어간다", () => {
  const unknown = company("ZZZZ", "테스트종목");
  const result = filterCompaniesByQuery([unknown], "zzzz");
  assert.deepEqual(result, [unknown]);
});

test("영어 이름은 단어 시작에서만 맞는다 — 'out'이 'Southern' 중간에 우연히 껴 있어도 걸리지 않는다", () => {
  const southern = company("SO", "서던"); // COMPANY_NAME_EN["SO"] = "Southern Company"
  const southwest = company("LUV", "사우스웨스트 항공"); // COMPANY_NAME_EN["LUV"] = "Southwest Airlines"
  const result = filterCompaniesByQuery([southern, southwest, APPLE], "out");
  assert.deepEqual(result, []);
});

test("영어 이름의 두 번째 단어 시작으로도 찾는다", () => {
  const southern = company("SO", "서던"); // "Southern Company"
  const result = filterCompaniesByQuery([southern, APPLE], "comp");
  assert.deepEqual(result, [southern]);
});
