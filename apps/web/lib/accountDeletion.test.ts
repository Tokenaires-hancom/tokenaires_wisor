import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_DELETE_CONFIRMATION,
  hasValidDeleteConfirmation,
  isSameOrigin,
} from "./accountDeletion.ts";

test("계정 삭제 확인 문구는 정확히 일치해야 한다", () => {
  assert.equal(hasValidDeleteConfirmation(ACCOUNT_DELETE_CONFIRMATION), true);
  assert.equal(hasValidDeleteConfirmation("삭제"), false);
  assert.equal(hasValidDeleteConfirmation("계정 삭제 "), false);
  assert.equal(hasValidDeleteConfirmation(undefined), false);
});

test("계정 삭제 요청은 같은 출처만 허용한다", () => {
  assert.equal(isSameOrigin("https://wisor.example", "https://wisor.example"), true);
  assert.equal(isSameOrigin("https://other.example", "https://wisor.example"), false);
  assert.equal(isSameOrigin(null, "https://wisor.example"), false);
});
