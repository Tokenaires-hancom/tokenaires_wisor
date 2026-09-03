import assert from "node:assert/strict";
import test from "node:test";
import { townLastCompletedPlot, townMasterLabel, townMascotPlot, townScenery } from "./townScene.ts";

test("레벨 1은 장식이 없다", () => {
  assert.deepEqual(townScenery(1), { path: false, bench: false });
});

test("레벨이 오르면 길·벤치가 열린다", () => {
  assert.equal(townScenery(2).path, false);
  assert.equal(townScenery(3).path, true);
  assert.equal(townScenery(5).bench, true);
});

test("마을 건물 아래에는 짧은 이름을 쓴다", () => {
  assert.equal(townMasterLabel("graham"), "그레이엄");
  assert.equal(townMasterLabel("buffett"), "버핏");
});

test("코인은 진행 중인 건물 칸에 선다", () => {
  const rows = [
    { masterId: "buffett", name: "버핏", done: 5, total: 5, complete: true },
    { masterId: "graham", name: "그레이엄", done: 2, total: 5, complete: false },
    { masterId: "lynch", name: "린치", done: 0, total: 5, complete: false },
  ];
  assert.equal(townMascotPlot(rows), 1);
});

test("여러 건물이 동시에 진행 중이면 가장 최근에 챕터를 끝낸 건물 칸에 선다", () => {
  const rows = [
    { masterId: "buffett", name: "버핏", done: 2, total: 5, complete: false },
    { masterId: "graham", name: "그레이엄", done: 3, total: 5, complete: false },
    { masterId: "lynch", name: "린치", done: 0, total: 5, complete: false },
  ];
  const lessonsDone = ["master:buffett:1", "master:graham:1", "master:buffett:2", "master:graham:2"];
  assert.equal(townMascotPlot(rows, lessonsDone), 1);
});

test("lessonsDone이 없으면 배열 순서상 첫 진행 중 건물로 대체한다", () => {
  const rows = [
    { masterId: "buffett", name: "버핏", done: 5, total: 5, complete: true },
    { masterId: "graham", name: "그레이엄", done: 2, total: 5, complete: false },
    { masterId: "lynch", name: "린치", done: 0, total: 5, complete: false },
  ];
  assert.equal(townMascotPlot(rows), 1);
});

test("진행 중인 건물이 없고 완료된 건물만 있으면 마스코트는 없다 — 완료된 건물엔 깃발만 남는다", () => {
  const rows = [
    { masterId: "buffett", name: "버핏", done: 5, total: 5, complete: true },
    { masterId: "graham", name: "그레이엄", done: 5, total: 5, complete: true },
    { masterId: "lynch", name: "린치", done: 0, total: 5, complete: false },
  ];
  assert.equal(townMascotPlot(rows), null);
});

test("아무 진행도 없으면 첫 칸에 선다", () => {
  const rows = [
    { masterId: "buffett", name: "버핏", done: 0, total: 5, complete: false },
    { masterId: "graham", name: "그레이엄", done: 0, total: 5, complete: false },
  ];
  assert.equal(townMascotPlot(rows), 0);
});

test("완공된 건물이 여럿이면 가장 최근에 완공한 건물 칸에만 불꽃이 튄다", () => {
  const rows = [
    { masterId: "buffett", name: "버핏", done: 5, total: 5, complete: true },
    { masterId: "graham", name: "그레이엄", done: 5, total: 5, complete: true },
    { masterId: "lynch", name: "린치", done: 2, total: 5, complete: false },
  ];
  const lessonsDone = ["master:buffett:5", "master:graham:5", "master:lynch:1"];
  assert.equal(townLastCompletedPlot(rows, lessonsDone), 1);
});

test("완공된 건물이 없으면 불꽃도 없다", () => {
  const rows = [
    { masterId: "buffett", name: "버핏", done: 2, total: 5, complete: false },
  ];
  assert.equal(townLastCompletedPlot(rows), null);
});
