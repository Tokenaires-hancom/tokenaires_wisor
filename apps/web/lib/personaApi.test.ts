import assert from "node:assert/strict";
import test from "node:test";
import {
  PersonaApiError,
  askQuestion,
  createSession,
  deleteSession,
  isAmbiguousSessionFailure,
  isGone,
  searchCompanies,
  switchPersona,
} from "./personaApi.ts";

type Reply = { ok: boolean; status: number; json: () => Promise<unknown> };

/** fetch를 가로채고 무엇을 어디로 보냈는지 모아둔다. 되돌리기는 호출한 쪽이 t.after로 건다. */
function stubFetch(reply: Reply) {
  const calls: { url: string; method: string | undefined; body: unknown }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return reply as unknown as Response;
  }) as typeof globalThis.fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function ok(payload: unknown): Reply {
  return { ok: true, status: 200, json: async () => payload };
}

const SESSION = {
  sessionId: "s1",
  persona: "buffett",
  personaName: "워런 버핏",
  verdict: "ok",
  regenerated: false,
  blocked: false,
  disclaimer: "관찰이지 권유가 아닙니다.",
};

test("createSession은 서버의 opening을 화면이 쓰는 text로 옮긴다", async (t) => {
  const stub = stubFetch(ok({ ...SESSION, opening: "첫 마디입니다" }));
  t.after(stub.restore);

  const message = await createSession("AAPL", "buffett");

  assert.equal(message.text, "첫 마디입니다");
  assert.equal(message.sessionId, "s1");
  assert.equal(message.personaName, "워런 버핏");
  assert.equal(stub.calls[0].url, "/api/persona/sessions");
  assert.deepEqual(stub.calls[0].body, { ticker: "AAPL", persona: "buffett" });
});

test("자유 대화 세션은 ticker를 보내지 않는다", async (t) => {
  const stub = stubFetch(ok({ ...SESSION, opening: "첫 마디입니다" }));
  t.after(stub.restore);

  const message = await createSession(null, "buffett");

  assert.equal(message.text, "첫 마디입니다");
  assert.deepEqual(stub.calls[0].body, { persona: "buffett" });
});

test("askQuestion은 서버의 reply를 text로 옮긴다", async (t) => {
  const stub = stubFetch(ok({ ...SESSION, reply: "답입니다" }));
  t.after(stub.restore);

  const message = await askQuestion("s1", "왜 그렇게 보세요?");

  assert.equal(message.text, "답입니다");
  assert.equal(stub.calls[0].url, "/api/persona/sessions/s1/messages");
  assert.deepEqual(stub.calls[0].body, { question: "왜 그렇게 보세요?" });
});

test("switchPersona도 opening을 text로 옮긴다", async (t) => {
  const stub = stubFetch(ok({ ...SESSION, persona: "graham", opening: "바뀐 첫 마디" }));
  t.after(stub.restore);

  const message = await switchPersona("s1", "graham");

  assert.equal(message.text, "바뀐 첫 마디");
  assert.equal(message.persona, "graham");
  assert.equal(stub.calls[0].url, "/api/persona/sessions/s1/persona");
});

test("blocked·regenerated 같은 안전 판정 플래그를 그대로 넘긴다", async (t) => {
  // 이 셋이 떨어지면 권유 문구를 걸러냈다는 사실이 화면에 안 뜬다.
  const stub = stubFetch(
    ok({ ...SESSION, opening: "다시 씀", verdict: "regenerate", regenerated: true, blocked: true }),
  );
  t.after(stub.restore);

  const message = await createSession("AAPL", "buffett");

  assert.equal(message.verdict, "regenerate");
  assert.equal(message.regenerated, true);
  assert.equal(message.blocked, true);
});

test("서버가 준 에러 코드와 문구를 PersonaApiError에 싣는다", async (t) => {
  const stub = stubFetch({
    ok: false,
    status: 404,
    json: async () => ({ error: { code: "session_not_found", message: "대화가 끝났습니다" } }),
  });
  t.after(stub.restore);

  const err = await askQuestion("s1", "질문").then(
    () => null,
    (e: unknown) => e,
  );

  assert.ok(err instanceof PersonaApiError);
  assert.equal(err.status, 404);
  assert.equal(err.code, "session_not_found");
  assert.equal(err.message, "대화가 끝났습니다");
});

test("에러 바디에 코드가 없으면 http_error로 대신한다", async (t) => {
  const stub = stubFetch({ ok: false, status: 500, json: async () => ({}) });
  t.after(stub.restore);

  const err = (await createSession("AAPL", "buffett").catch((e: unknown) => e)) as PersonaApiError;

  assert.equal(err.code, "http_error");
  assert.match(err.message, /500/);
});

test("성공 응답인데 JSON이 아니면 상태를 0으로 둔다", async (t) => {
  // 2xx를 그대로 실으면 "성공했는데 실패"로 읽힌다. 0은 HTTP 상태가 없다는 뜻이다.
  const stub = stubFetch({ ok: true, status: 200, json: async () => { throw new Error("not json"); } });
  t.after(stub.restore);

  const err = (await createSession("AAPL", "buffett").catch((e: unknown) => e)) as PersonaApiError;

  assert.equal(err.status, 0);
  assert.equal(err.code, "invalid_json");
});

test("searchCompanies는 검색어와 개수를 쿼리로 붙인다", async (t) => {
  const stub = stubFetch(ok({ query: "애플", results: [] }));
  t.after(stub.restore);

  await searchCompanies("애플", 3);

  assert.equal(stub.calls[0].url, `/api/persona/companies?q=${encodeURIComponent("애플")}&limit=3`);
});

test("종목 선택 해제는 기존 서버 세션을 삭제한다", async (t) => {
  const stub = stubFetch({ ok: true, status: 200, json: async () => ({ deleted: true }) });
  t.after(stub.restore);

  await deleteSession("session-1");

  assert.equal(stub.calls[0].url, "/api/persona/sessions/session-1");
  assert.equal(stub.calls[0].method, "DELETE");
  assert.equal(stub.calls[0].body, undefined);
});

test("isGone은 대화가 사라진 경우에만 참이다", () => {
  assert.equal(isGone(new PersonaApiError(404, "session_not_found", "")), true);
  assert.equal(isGone(new PersonaApiError(500, "http_error", "")), false);
  assert.equal(isGone(new Error("session_not_found")), false);
});

test("반영 여부가 모호한 실패만 세션 폐기 대상으로 본다", () => {
  assert.equal(isAmbiguousSessionFailure(new TypeError("network")), true);
  assert.equal(isAmbiguousSessionFailure(new PersonaApiError(0, "invalid_json", "bad json")), true);
  assert.equal(isAmbiguousSessionFailure(new PersonaApiError(502, "upstream", "bad gateway")), true);
  assert.equal(
    isAmbiguousSessionFailure(new PersonaApiError(502, "model_error", "model failed")),
    false,
  );
  assert.equal(
    isAmbiguousSessionFailure(new PersonaApiError(429, "rate_limited", "later")),
    false,
  );
});
