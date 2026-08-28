import assert from "node:assert/strict";
import test from "node:test";
import { MASTERS, SCORABLE_MASTERS } from "./masters.ts";

test("점수형 대가와 자가진단형 대가의 경계를 고정한다", () => {
  assert.deepEqual(
    SCORABLE_MASTERS.map((master) => master.id),
    ["buffett", "graham", "lynch", "greenblatt"],
  );
});

test("일곱 대가 모두 세 가지 업적과 근거를 가진다", () => {
  assert.equal(MASTERS.length, 7);

  for (const master of MASTERS) {
    assert.equal(master.achievements.length, 3, `${master.id} 업적 개수`);

    for (const achievement of master.achievements) {
      assert.ok(achievement.label.trim(), `${master.id} 업적 표지`);
      assert.ok(achievement.title.trim(), `${master.id} 업적 제목`);
      assert.ok(achievement.body.trim(), `${master.id} 업적 설명`);
      assert.ok(achievement.source.trim(), `${master.id} 업적 근거`);
    }
  }
});
