import assert from "node:assert/strict";
import test from "node:test";
import { characterGuide, characterStand, hasCharacter } from "./characters.ts";

test("버핏은 캐릭터를 가지고 있다", () => {
  assert.equal(hasCharacter("buffett"), true);
});

test("일곱 대가 모두 정지 캐릭터를 가지고 있다", () => {
  for (const id of ["buffett", "graham", "lynch", "fisher", "greenblatt", "marks", "soros"]) {
    assert.equal(hasCharacter(id), true);
  }
});

test("모르는 id도 false — 예외를 던지지 않는다", () => {
  assert.equal(hasCharacter("nobody"), false);
});

test("전신 이미지 경로", () => {
  assert.equal(characterStand("buffett"), "/characters/buffett/stand.webp");
});

test("대가별 전신 이미지 경로", () => {
  assert.equal(characterStand("graham"), "/characters/graham/stand.webp");
  assert.equal(characterStand("soros"), "/characters/soros/stand.webp");
});

test("안내 애니메이션 경로", () => {
  assert.equal(characterGuide("buffett"), "/characters/buffett/guide.webp");
});

test("안내 이미지가 없는 대가는 null", () => {
  assert.equal(characterGuide("lynch"), null);
});
