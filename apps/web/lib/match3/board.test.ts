import assert from "node:assert/strict";
import test from "node:test";
import { findMatches, isValidSwap, collapse, makeBoard } from "./board.ts";

const keys = (s: Set<string>) => [...s].sort();

test("매치가 없으면 빈 집합", () => {
  const b = [
    [0, 1, 0],
    [1, 0, 1],
    [0, 1, 0],
  ];
  assert.equal(findMatches(b).size, 0);
});

test("가로 3개는 그 세 칸을 반환", () => {
  const b = [
    [2, 2, 2],
    [0, 1, 0],
    [1, 0, 1],
  ];
  assert.deepEqual(keys(findMatches(b)), ["0,0", "0,1", "0,2"]);
});

test("세로 3개는 그 세 칸을 반환", () => {
  const b = [
    [3, 0, 1],
    [3, 1, 0],
    [3, 0, 1],
  ];
  assert.deepEqual(keys(findMatches(b)), ["0,0", "1,0", "2,0"]);
});

test("빈 칸(-1)은 3개 연속이어도 매치가 아니다", () => {
  const b = [
    [-1, -1, -1],
    [0, 1, 0],
    [1, 0, 1],
  ];
  assert.equal(findMatches(b).size, 0);
});

test("가로·세로가 겹치는 L자는 합집합", () => {
  // (0,0)(0,1)(0,2) 가로 + (0,0)(1,0)(2,0) 세로
  const b = [
    [4, 4, 4],
    [4, 0, 1],
    [4, 1, 0],
  ];
  assert.deepEqual(keys(findMatches(b)), ["0,0", "0,1", "0,2", "1,0", "2,0"]);
});

test("스왑이 매치를 만들면 유효", () => {
  const b = [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ];
  // (0,1)↔(1,1) 바꾸면 윗줄이 1,1,1
  assert.equal(isValidSwap(b, { r: 0, c: 1 }, { r: 1, c: 1 }), true);
});

test("스왑이 매치를 못 만들면 무효", () => {
  const b = [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ];
  assert.equal(isValidSwap(b, { r: 0, c: 0 }, { r: 0, c: 1 }), false);
});

test("isValidSwap은 원본 보드를 바꾸지 않는다", () => {
  const b = [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ];
  isValidSwap(b, { r: 0, c: 1 }, { r: 1, c: 1 });
  assert.deepEqual(b, [
    [1, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ]);
});

test("collapse: 매치 제거 후 중력·리필", () => {
  const b = [
    [2, 2, 2],
    [3, 4, 5],
    [6, 7, 8],
  ];
  const out = collapse(b, findMatches(b), () => 9);
  assert.deepEqual(out, [
    [9, 9, 9],
    [3, 4, 5],
    [6, 7, 8],
  ]);
});

test("collapse는 원본을 바꾸지 않는다", () => {
  const b = [
    [2, 2, 2],
    [3, 4, 5],
    [6, 7, 8],
  ];
  collapse(b, findMatches(b), () => 9);
  assert.equal(b[0][0], 2);
});

test("makeBoard: 크기·값 범위가 맞고 시작 매치가 없다", () => {
  const rand = () => Math.floor(Math.random() * 5);
  const b = makeBoard(5, 5, 5, rand);
  assert.equal(b.length, 5);
  assert.ok(b.every((row) => row.length === 5));
  assert.ok(b.every((row) => row.every((v) => v >= 0 && v < 5)));
  assert.equal(findMatches(b).size, 0);
});
