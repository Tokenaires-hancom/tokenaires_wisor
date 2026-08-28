import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const componentSource = readFileSync(
  new URL("../components/PersonaChatFab.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("챗봇의 persona 클래스는 모두 CSS 선택자와 연결된다", () => {
  const componentClasses = [
    ...new Set(
      [...componentSource.matchAll(/className="([^"]+)"/g)]
        .flatMap((match) => match[1].split(/\s+/))
        .filter((className) => className.startsWith("persona-")),
    ),
  ];

  assert.ok(componentClasses.length > 0);

  const missing = [...componentClasses]
    .filter(
      (className) =>
        !new RegExp(`\\.${escapeRegExp(className)}(?![\\w-])`).test(cssSource),
    )
    .sort();

  assert.deepEqual(missing, []);
});

test("질문 입력과 메시지 역할 선택자가 실제 DOM 소유자와 연결된다", () => {
  const formSource = componentSource.match(
    /<form\b[^>]*className="persona-ask"[^>]*>([\s\S]*?)<\/form>/,
  )?.[1];

  assert.ok(formSource, "persona-ask form을 찾을 수 없습니다.");

  const controlTags = [
    ...new Set(
      [...formSource.matchAll(/<(input|textarea|select)\b/g)].map(
        (match) => match[1],
      ),
    ),
  ];

  assert.ok(controlTags.length > 0, "질문 입력 요소를 찾을 수 없습니다.");

  const unstyledControls = controlTags.filter(
    (tagName) =>
      !new RegExp(`\\.persona-ask(?![\\w-])[^,{]*\\b${tagName}\\b`).test(
        cssSource,
      ),
  );

  assert.deepEqual(unstyledControls, []);

  const roleElement = componentSource.match(
    /<[^>]*\bdata-role=\{[^}]+\}[^>]*>/s,
  )?.[0];

  assert.ok(roleElement, "data-role 메시지 요소를 찾을 수 없습니다.");

  const roleOwner = roleElement
    .match(/className="([^"]+)"/)?.[1]
    .split(/\s+/)
    .find((className) => className.startsWith("persona-"));

  assert.ok(roleOwner, "data-role 소유 클래스가 없습니다.");

  assert.match(
    cssSource,
    new RegExp(
      `\\.${escapeRegExp(roleOwner)}\\[data-role\\s*=\\s*(?:["']user["']|user)\\]`,
    ),
  );
});

test("종목을 고르지 않아도 질문 입력과 제출이 열려 있다", () => {
  const askSource = componentSource.match(
    /async function onAsk\b[\s\S]*?(?=\n  async function onPersona)/,
  )?.[0];
  const textarea = componentSource.match(/<textarea\b[\s\S]*?\/>/)?.[0];

  assert.ok(askSource, "onAsk 함수를 찾을 수 없습니다.");
  assert.ok(textarea, "질문 textarea를 찾을 수 없습니다.");
  assert.doesNotMatch(askSource, /if\s*\(\s*!ticker\s*\)/);
  assert.doesNotMatch(textarea, /disabled=\{[^}]*ticker/);
  assert.match(textarea, /투자 철학이나 판단 기준을 물어보세요/);
  assert.match(componentSource, /종목 선택 \(선택 사항\)/);
});

test("자유 대화 세션에서도 대가 전환을 서버에 반영한다", () => {
  const personaSource = componentSource.match(
    /async function onPersona\b[\s\S]*?(?=\n  \/\/ 점수를 내지 않는 대가)/,
  )?.[0];

  assert.ok(personaSource, "onPersona 함수를 찾을 수 없습니다.");
  assert.doesNotMatch(personaSource, /if\s*\(\s*!ticker\s*\)\s*return/);
  assert.match(personaSource, /if\s*\(id === persona\) return/);
  assert.match(personaSource, /switchPersona\(activeSessionId, id\)/);
  assert.match(personaSource, /createSession\(ticker, id\)/);
  assert.match(personaSource, /setSessionId\(null\)/);
});

test("확정적인 질문·대가 전환 실패는 기존 화면 문맥을 보존한다", () => {
  const askSource = componentSource.match(
    /async function onAsk\b[\s\S]*?(?=\n  async function onPersona)/,
  )?.[0];
  const personaSource = componentSource.match(
    /async function onPersona\b[\s\S]*?(?=\n  \/\/ 점수를 내지 않는 대가)/,
  )?.[0];

  assert.ok(askSource, "onAsk 함수를 찾을 수 없습니다.");
  assert.ok(personaSource, "onPersona 함수를 찾을 수 없습니다.");
  assert.match(askSource, /let rollbackMessages = messages/);
  assert.match(askSource, /setMessages\(rollbackMessages\)/);
  assert.match(askSource, /setQuestion\(text\)/);
  assert.match(personaSource, /if \(reply\.blocked\)/);
  assert.match(
    personaSource,
    /if \(sessionGone \|\| isAmbiguousSessionFailure\(err\)\)/,
  );
});

test("만료된 세션을 다시 만들면 화면 문맥도 새 opening부터 시작한다", () => {
  const askSource = componentSource.match(
    /async function onAsk\b[\s\S]*?(?=\n  async function onPersona)/,
  )?.[0];

  assert.ok(askSource, "onAsk 함수를 찾을 수 없습니다.");
  assert.match(askSource, /activeSessionId = null;\s*rollbackMessages = \[\];/);
  assert.match(
    askSource,
    /rollbackMessages = \[\{ role: "tutor", text: opened\.text \}\]/,
  );
  assert.match(
    askSource,
    /setMessages\(\[\.\.\.rollbackMessages, \{ role: "user", text \}\]\)/,
  );
});

test("패널 닫기는 대기 중이던 자동 세션 시작을 무효화한다", () => {
  const closeSource = componentSource.match(
    /function closePanel\b[\s\S]*?(?=\n  async function onToggle)/,
  )?.[0];
  const toggleSource = componentSource.match(
    /async function onToggle\b[\s\S]*?(?=\n  async function onSearch)/,
  )?.[0];

  assert.ok(closeSource, "closePanel 함수를 찾을 수 없습니다.");
  assert.ok(toggleSource, "onToggle 함수를 찾을 수 없습니다.");
  assert.match(componentSource, /const panelSeq = useRef\(0\)/);
  assert.match(closeSource, /panelSeq\.current \+= 1/);
  assert.match(toggleSource, /const panelGeneration = \+\+panelSeq\.current/);
  assert.match(toggleSource, /start\(ticker, resolvedPersona, panelGeneration\)/);
  assert.match(componentSource, /onClick=\{closePanel\}/);
});

test("이전 화면에서 늦게 온 대화 응답은 현재 문맥을 덮지 않는다", () => {
  assert.match(componentSource, /const conversationSeq = useRef\(0\)/);
  assert.match(componentSource, /conversationSeq\.current \+= 1/);
  assert.match(componentSource, /seq !== conversationSeq\.current/);
});

test("반영 여부가 모호한 질문 실패는 숨은 서버 문맥을 이어 쓰지 않는다", () => {
  const askSource = componentSource.match(
    /async function onAsk\b[\s\S]*?(?=\n  async function onPersona)/,
  )?.[0];

  assert.ok(askSource, "onAsk 함수를 찾을 수 없습니다.");
  assert.match(askSource, /isAmbiguousSessionFailure\(err\)/);
  assert.match(askSource, /setSessionId\(null\)/);
  assert.match(askSource, /setMessages\(\[\]\)/);
});

test("종목 선택 해제는 자유 대화 상태와 빈 세션으로 돌아간다", () => {
  const clearSource = componentSource.match(
    /function onClearTicker\b[\s\S]*?(?=\n  async function onAsk)/,
  )?.[0];
  const clearButton = componentSource.match(
    /<button\b(?=[^>]*className="[^"]*persona-context-ticker[^"]*")[^>]*>[\s\S]*?<\/button>/,
  )?.[0];

  assert.ok(clearSource, "onClearTicker 함수를 찾을 수 없습니다.");
  assert.ok(clearButton, "종목 선택 해제 버튼을 찾을 수 없습니다.");
  assert.match(clearSource, /conversationSeq\.current \+= 1/);
  assert.match(clearSource, /searchSeq\.current \+= 1/);
  assert.match(clearSource, /setTicker\(null\)/);
  assert.match(clearSource, /setSessionId\(null\)/);
  assert.match(clearSource, /setMessages\(\[\]\)/);
  assert.match(clearSource, /setQuery\(""\)/);
  assert.match(clearSource, /discardSession\(activeSessionId\)/);
  assert.doesNotMatch(clearButton, /\bdisabled=/);
  assert.match(clearButton, /className="persona-context-ticker-close"/);
  assert.match(clearButton, />×<\/span>/);
  assert.doesNotMatch(componentSource, /className="persona-context-clear"/);
  assert.match(componentSource, /if \(ticker && !sessionId\)/);
  assert.doesNotMatch(componentSource, /freeChatOverride/);
});

test("해제와 겹쳐 늦게 만들어진 세션도 서버에서 정리한다", () => {
  const staleBranches = [
    ...componentSource.matchAll(
      /if \(seq !== conversationSeq\.current\) \{\s*discardSession\((?:reply|opened)\.sessionId\);\s*return;\s*\}/g,
    ),
  ];

  assert.ok(staleBranches.length >= 4);
});
