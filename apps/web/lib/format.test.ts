import assert from "node:assert/strict";
import test from "node:test";
import { formatMetric } from "./format.ts";
import { METRIC_LABELS } from "./scores.types.ts";

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
