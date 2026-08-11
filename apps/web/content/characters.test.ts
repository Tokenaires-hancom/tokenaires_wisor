import assert from "node:assert/strict";
import test from "node:test";
import { characterMood, characterStand, hasCharacter } from "./characters.ts";

test("버핏은 캐릭터를 가지고 있다", () => {
  assert.equal(hasCharacter("buffett"), true);
});

test("아직 캐릭터가 없는 대가는 false", () => {
  assert.equal(hasCharacter("graham"), false);
  assert.equal(hasCharacter("soros"), false);
});

test("모르는 id도 false — 예외를 던지지 않는다", () => {
  assert.equal(hasCharacter("nobody"), false);
});

test("전신 이미지 경로", () => {
  assert.equal(characterStand("buffett"), "/characters/buffett/stand.webp");
});

test("캐릭터가 없으면 전신 경로도 null", () => {
  assert.equal(characterStand("graham"), null);
});

test("기분별 GIF 경로", () => {
  assert.equal(characterMood("buffett", "great"), "/characters/buffett/great.gif");
  assert.equal(characterMood("buffett", "nope"), "/characters/buffett/nope.gif");
  assert.equal(characterMood("buffett", "guide"), "/characters/buffett/guide.gif");
  assert.equal(characterMood("buffett", "proud"), "/characters/buffett/proud.gif");
  assert.equal(characterMood("buffett", "aha"), "/characters/buffett/aha.gif");
});

test("캐릭터가 없으면 기분 경로도 null", () => {
  assert.equal(characterMood("lynch", "great"), null);
});
