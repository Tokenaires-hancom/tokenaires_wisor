import assert from "node:assert/strict";
import test from "node:test";
import { townMasterLabel, townMascotPlot, townScenery } from "./townScene.ts";

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

test("진행 중인 건물이 없으면 마지막으로 완성한 건물 칸에 선다", () => {
  const rows = [
    { masterId: "buffett", name: "버핏", done: 5, total: 5, complete: true },
    { masterId: "graham", name: "그레이엄", done: 5, total: 5, complete: true },
    { masterId: "lynch", name: "린치", done: 0, total: 5, complete: false },
  ];
  assert.equal(townMascotPlot(rows), 1);
});

test("아무 진행도 없으면 첫 칸에 선다", () => {
  const rows = [
    { masterId: "buffett", name: "버핏", done: 0, total: 5, complete: false },
    { masterId: "graham", name: "그레이엄", done: 0, total: 5, complete: false },
  ];
  assert.equal(townMascotPlot(rows), 0);
});
