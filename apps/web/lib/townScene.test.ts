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

test("코인은 레벨에 따라 건물 칸을 옮긴다", () => {
  assert.equal(townMascotPlot(1), 0);
  assert.equal(townMascotPlot(4), 3);
  assert.equal(townMascotPlot(9), 6);
});
