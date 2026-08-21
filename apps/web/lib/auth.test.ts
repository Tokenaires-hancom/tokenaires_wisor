import assert from "node:assert/strict";
import test from "node:test";
import { authErrorMessage, relativeRedirect, safeNextPath } from "./auth.ts";

test("relativeRedirect는 현재 origin을 유지하는 상대 경로를 반환한다", () => {
  const response = relativeRedirect("/login?error=callback");

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "/login?error=callback");
});

test("safeNextPath는 앱 내부 경로만 허용한다", () => {
  assert.equal(safeNextPath("/learn/masters/buffett"), "/learn/masters/buffett");
  assert.equal(safeNextPath("https://example.com"), "/me");
  assert.equal(safeNextPath("//example.com"), "/me");
  assert.equal(safeNextPath(null), "/me");
});

test("인증 오류를 사용자가 해결할 수 있는 문장으로 바꾼다", () => {
  assert.equal(authErrorMessage("invalid_credentials"), "이메일이나 비밀번호가 맞지 않습니다.");
  assert.match(authErrorMessage(undefined), /다시 시도/);
});
