import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_DELETE_CONFIRMATION,
  hasValidDeleteConfirmation,
  isSameOrigin,
  siteOrigin,
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

test("계정 삭제를 받아들일 주소는 설정값을 쓰고, 없으면 로컬 기본값을 쓴다", () => {
  assert.equal(siteOrigin("https://wisor.site"), "https://wisor.site");
  assert.equal(siteOrigin(undefined), "http://localhost:3000");
  assert.equal(siteOrigin(""), "http://localhost:3000");
});

test("배포에서 브라우저가 보내는 Origin은 서버 바인딩 주소와 같지 않다", () => {
  // 이 한 줄이 배포 결함의 전부였다. nextUrl.origin으로 되돌리면 다시 이 상태가 된다.
  assert.equal(isSameOrigin("https://wisor.site", "https://localhost:3000"), false);
  assert.equal(isSameOrigin("https://wisor.site", siteOrigin("https://wisor.site")), true);
});
