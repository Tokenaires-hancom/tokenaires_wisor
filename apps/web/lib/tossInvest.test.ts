import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStockSymbol } from "./tossInvest.ts";

test("종목코드와 미국 티커를 정규화한다", () => {
  assert.equal(normalizeStockSymbol(" 005930 "), "005930");
  assert.equal(normalizeStockSymbol("brk.b"), "BRK.B");
});

test("허용하지 않는 종목 검색값은 거부한다", () => {
  assert.equal(normalizeStockSymbol("삼성전자"), null);
  assert.equal(normalizeStockSymbol("AAPL,MSFT"), null);
  assert.equal(normalizeStockSymbol("AAPL?secret=x"), null);
  assert.equal(normalizeStockSymbol(""), null);
  assert.equal(normalizeStockSymbol("A".repeat(21)), null);
});

test("점과 하이픈이 들어간 미국 티커를 허용한다", () => {
  assert.equal(normalizeStockSymbol("BRK.B"), "BRK.B");
  assert.equal(normalizeStockSymbol("BF-B"), "BF-B");
});
