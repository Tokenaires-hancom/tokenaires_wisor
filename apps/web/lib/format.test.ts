import assert from "node:assert/strict";
import test from "node:test";
import { dateRange, displayModelVersion, formatMetric } from "./format.ts";
import { METRIC_LABELS, indexNames } from "./scores.types.ts";

test("지수 이름은 슬러그가 아니라 사람이 읽는 이름으로 쓴다", () => {
  assert.equal(indexNames(["sp500"]), "S&P 500");
});

test("지수 순서는 배치가 넘긴 순서가 아니라 정해진 순서를 따른다", () => {
  // 배치는 슬러그를 알파벳순으로 넘겨 NASDAQ-100이 앞에 온다. 큰 지수를 먼저 쓴다.
  assert.equal(indexNames(["nasdaq100", "sp500"]), "S&P 500 · NASDAQ-100");
});

test("모르는 지수는 그대로 두고 뒤에 붙인다", () => {
  assert.equal(indexNames(["kospi200", "sp500"]), "S&P 500 · kospi200");
});

test("회계연도가 제각각이면 재무 기준일을 범위로 쓴다", () => {
  // 목록 화면의 9종목은 회계연도 종료일이 6개로 흩어져 있다. 하나를 고르면
  // 나머지 8종목에 대해 틀린 날짜가 된다.
  assert.equal(dateRange("2025-11-28", "2026-06-30"), "2025-11-28 ~ 2026-06-30");
});

test("기준일이 하나뿐이면 범위로 쓰지 않는다", () => {
  assert.equal(dateRange("2025-12-31", "2025-12-31"), "2025-12-31");
});

test("그린블랫 모델 버전은 화면에서 한글로 표시한다", () => {
  assert.equal(displayModelVersion("Greenblatt 1.0"), "그린블랫 1.0");
  assert.equal(displayModelVersion("Buffett 1.0"), "Buffett 1.0");
});

test("상한이 정해진 지표는 큰 값을 숫자 그대로 쓰지 않는다", () => {
  // 이자 부담이 거의 없는 회사는 배수가 무의미하게 커진다(실측 ULTA 8286배).
  assert.equal(formatMetric(8286.44, "x", 100), "100배 초과");
});

test("상한 아래 값은 그대로 쓴다", () => {
  assert.equal(formatMetric(52.9, "x", 100), "52.9배");
});

test("상한을 정하지 않은 지표는 큰 값도 그대로 쓴다", () => {
  // PER 150은 이상한 값이 아니라 비싼 값이다. 가리면 안 된다.
  assert.equal(formatMetric(150, "x"), "150.0배");
});

test("이자보상배율에 상한이 걸려 있다", () => {
  assert.equal(METRIC_LABELS.interestCoverage.cap, 100);
  assert.equal(METRIC_LABELS.pe.cap, undefined);
});
