import assert from "node:assert/strict";
import test from "node:test";
import { pinProgress } from "./pinProgress.ts";

const PINNABLE = 2654;

test("통이 화면 아래에 있으면 아직 시작하지 않았다", () => {
  assert.equal(pinProgress(500, PINNABLE), 0);
});
test("통 위가 화면 상단에 닿는 순간이 시작점이다", () => {
  assert.equal(pinProgress(0, PINNABLE), 0);
});

test("절반을 지나면 0.5다", () => {
  assert.equal(pinProgress(-PINNABLE / 2, PINNABLE), 0.5);
});

test("끝까지 지나면 1이다", () => {
  assert.equal(pinProgress(-PINNABLE, PINNABLE), 1);
});

test("끝을 넘어가도 1에서 멈춘다", () => {
  assert.equal(pinProgress(-PINNABLE * 3, PINNABLE), 1);
});

test("붙잡을 길이가 없으면 0으로 나누지 않는다", () => {
  assert.equal(pinProgress(-100, 0), 0);
  assert.equal(pinProgress(-100, -50), 0);
});

test("붙잡을 길이가 NaN이어도 0을 준다", () => {
  assert.equal(pinProgress(-100, Number.NaN), 0);
});
