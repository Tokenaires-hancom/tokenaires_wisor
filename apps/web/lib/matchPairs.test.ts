import assert from "node:assert/strict";
import test from "node:test";
import { isMatch, isComplete, type PairItem } from "./matchPairs.ts";

const term = (pairId: number): PairItem => ({ pairId, side: "term", text: "t" });
const def = (pairId: number): PairItem => ({ pairId, side: "def", text: "d" });

test("같은 짝의 용어와 정의는 매치", () => {
  assert.equal(isMatch(term(1), def(1)), true);
});

test("같은 쪽끼리는 매치 아님", () => {
  assert.equal(isMatch(term(1), term(1)), false);
  assert.equal(isMatch(def(2), def(2)), false);
});

test("다른 짝이면 매치 아님", () => {
  assert.equal(isMatch(term(1), def(2)), false);
});

test("모든 짝을 맞추면 완료", () => {
  assert.equal(isComplete(new Set([1, 2, 3]), 3), true);
  assert.equal(isComplete(new Set([1, 2]), 3), false);
});
