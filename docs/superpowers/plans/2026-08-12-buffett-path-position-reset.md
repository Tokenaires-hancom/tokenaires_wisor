# Buffett Path Position and Restart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Buffett in one of three stable learning-path zones without overlapping nodes or CTA bubbles, and let a learner reset only Buffett progress while preserving written journal answers.

**Architecture:** A small pure helper maps the active chapter to an early (1·2), middle (3), or late (4·5/completed) path anchor. `MasterPath` renders Buffett at that anchor while `store.ts` owns a narrowly scoped reset operation backed by a pure transformation that can be tested without browser storage. CSS expresses the character-to-node relationship and styles restart as a secondary action.

**Tech Stack:** Next.js 15, React 19, TypeScript, CSS, Node test runner, browser-rendered responsive verification.

## Global Constraints

- Do not modify curriculum content, quiz prompts, or answer data.
- Preserve journal entries, notes, watchlist, and every other master's progress.
- Character sizes remain desktop 190px, tablet 150px, mobile 124px.
- Character itself remains static; only the resume speech bubble may animate.
- Use only three character anchors: row 2 for chapters 1·2, row 3 for chapter 3, row 5 for chapters 4·5 and completed progress.
- In the early anchor, the character must begin below the master introduction at every responsive size.
- Do not add dependencies.
- Do not commit or push until the user explicitly asks after the design work is complete.

---

### Task 1: Master-Scoped Progress Reset

**Files:**
- Modify: `apps/web/lib/store.ts`
- Create: `apps/web/lib/store.test.ts`

**Interfaces:**
- Produces: `withoutMasterProgress(progress: Progress, masterId: string): Progress`
- Produces: `resetMasterProgress(masterId: string): Promise<void>`
- Preserves: the input `Progress` object and every non-matching entry.

- [x] **Step 1: Write the failing transformation test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { withoutMasterProgress } from "./store.ts";

test("해당 대가의 완료와 퀴즈만 초기화한다", () => {
  const progress = {
    lessonsDone: ["master:buffett:1", "master:graham:1"],
    quizResults: {
      "master:buffett:1": { correct: 2, total: 3, at: "2026-08-12T00:00:00.000Z" },
      "master:graham:1": { correct: 3, total: 3, at: "2026-08-12T00:00:00.000Z" },
    },
  };

  assert.deepEqual(withoutMasterProgress(progress, "buffett"), {
    lessonsDone: ["master:graham:1"],
    quizResults: {
      "master:graham:1": { correct: 3, total: 3, at: "2026-08-12T00:00:00.000Z" },
    },
  });
  assert.equal(progress.lessonsDone.length, 2);
});
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `cd apps/web && node --test lib/store.test.ts`

Expected: FAIL because `withoutMasterProgress` is not exported.

- [x] **Step 3: Implement the pure transformation and storage wrapper**

```ts
export function withoutMasterProgress(progress: Progress, masterId: string): Progress {
  const prefix = `master:${masterId}:`;
  return {
    lessonsDone: progress.lessonsDone.filter((id) => !id.startsWith(prefix)),
    quizResults: Object.fromEntries(
      Object.entries(progress.quizResults).filter(([id]) => !id.startsWith(prefix)),
    ),
  };
}

export async function resetMasterProgress(masterId: string): Promise<void> {
  write(KEYS.progress, withoutMasterProgress(await getProgress(), masterId));
}
```

- [x] **Step 4: Run the focused test**

Run: `cd apps/web && node --test lib/store.test.ts`

Expected: PASS, including the assertion that the source object was not mutated.

---

### Task 2: Three-Zone Character Anchor and Restart Control

**Files:**
- Create: `apps/web/lib/masterPathAnchor.ts`
- Create: `apps/web/lib/masterPathAnchor.test.ts`
- Modify: `apps/web/components/MasterPath.tsx`

**Interfaces:**
- Consumes: `resetMasterProgress(masterId: string): Promise<void>` from Task 1.
- Produces: the character at row 2 for chapters 1·2, row 3 for chapter 3, and row 5 for chapters 4·5/completed.
- Produces: a restart button only when `ready && done.size > 0`.

- [x] **Step 1: Write the failing three-zone mapping test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { getCharacterAnchor } from "./masterPathAnchor.ts";

test("버핏은 1·2 / 3 / 4·5의 세 구간에서만 이동한다", () => {
  assert.equal(getCharacterAnchor(1), 2);
  assert.equal(getCharacterAnchor(2), 2);
  assert.equal(getCharacterAnchor(3), 3);
  assert.equal(getCharacterAnchor(4), 5);
  assert.equal(getCharacterAnchor(5), 5);
  assert.equal(getCharacterAnchor(undefined), 5);
});
```

- [x] **Step 2: Run the focused test and verify failure**

Run: `cd apps/web && node --test lib/masterPathAnchor.test.ts`

Expected: FAIL because `masterPathAnchor.ts` does not exist.

- [x] **Step 3: Implement the pure anchor mapping**

```ts
export function getCharacterAnchor(nextNo: number | undefined): number {
  if (nextNo === undefined || nextNo >= 4) return 5;
  if (nextNo === 3) return 3;
  return 2;
}
```

Replace `figureAt` in `MasterPath.tsx` with:

```ts
const figureAt = getCharacterAnchor(nextNo);
```

This puts the early anchor below the introduction, keeps chapter 3 centered on its own step, and gives chapters 4·5 one stable late position.

- [x] **Step 4: Add the confirmed restart handler**

```ts
async function restartLearning() {
  const confirmed = window.confirm(
    `${master.name} 학습을 처음부터 다시 시작할까요? 완료 상태와 퀴즈 결과만 초기화되며 기록형 답변은 유지됩니다.`,
  );
  if (!confirmed) return;
  await resetMasterProgress(masterId);
  setDone(new Set());
  setReady(true);
}
```

- [x] **Step 5: Render the secondary restart action**

Place it after the ordered path and primary completion CTA:

```tsx
{ready && done.size > 0 && (
  <button type="button" className="path-restart" onClick={restartLearning}>
    처음부터 학습하기
  </button>
)}
```

Expected behavior: cancel leaves state untouched; confirm redraws chapter 1 as current without reloading.

- [x] **Step 6: Run the focused anchor test**

Run: `cd apps/web && node --test lib/masterPathAnchor.test.ts`

Expected: PASS.

---

### Task 3: Safe Three-Zone Spacing and Restart Styling

**Files:**
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `.path-figure`, `.path-row`, `.path-restart` markup from Task 2.
- Produces: 20px desktop/tablet and 14px mobile character-to-node clearance, with the first anchor below the introduction.

- [x] **Step 1: Keep the shared safe horizontal relationship**

```css
.path-figure {
  right: calc(50% + 34px - var(--sway, 0px) + 20px);
  bottom: 16px;
}

@media (max-width: 640px) {
  .path-figure {
    right: calc(50% + 34px - var(--sway, 0px) * 0.5 + 14px);
    bottom: 16px;
  }
}
```

Keep the existing discrete image heights of 190px, 150px, and 124px.

The three anchors use the existing row positioning: row 2 naturally places the early character below the introduction, row 3 forms the middle stop, and row 5 forms the late stop. Do not add per-viewport pixel coordinates.

Add only these anchor-specific corrections, preserving the late anchor unchanged:

```css
.path-figure[data-anchor="2"] {
  right: calc(50% + 34px - var(--sway, 0px) + 88px);
  bottom: -26px;
}

.path-figure[data-anchor="3"] {
  right: calc(50% + 34px - var(--sway, 0px) + 40px);
  bottom: -50px;
}
```

At 1100px and below, restore anchor 2's `bottom` to `-14px` because its CTA
is rendered above the current node instead of within the character figure. At
640px and below, use `58px` for anchor 2 and `34px` for anchor 3 in place of
the desktop horizontal correction.

- [x] **Step 2: Style restart as a subordinate action**

```css
.path-restart {
  margin-top: 0.75rem;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
  font: inherit;
  font-size: 0.82rem;
  text-decoration: underline;
  text-underline-offset: 0.22em;
  cursor: pointer;
}

.path-restart:hover,
.path-restart:focus-visible {
  color: var(--wine);
}
```

The control must retain the project's global focus ring.

---

### Task 4: Verification and Handoff

**Files:**
- Modify: `docs/HANDOFF.md`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: verified responsive behavior and accurate agent handoff notes.

- [x] **Step 1: Run all automated tests**

Run: `cd apps/web && npm test`

Expected: 71 tests pass, 0 fail.

- [x] **Step 2: Run the layout detector once**

Run:

```powershell
node C:\Users\Har27\.codex\plugins\cache\impeccable\impeccable\4.0.4\skills\impeccable\scripts\detect.mjs --json --scope layout apps/web/app/globals.css apps/web/components/MasterPath.tsx
```

Expected: `[]` or only findings explained in the handoff.

- [x] **Step 3: Verify every progress position**

Inspect progress states 0, 1, 2, 3, 4, and 5 completed chapters. At each state verify:

- the character is attached to the current node, or node 5 when complete;
- its bounding box does not intersect the node bounding box;
- computed horizontal clearance is at least 20px on desktop/tablet and 14px on mobile;
- no horizontal document overflow appears.

- [x] **Step 4: Verify representative viewports**

Inspect 1920, 1180, 1024, 900, 640, 510, and 360px widths. Confirm discrete character heights are 190, 150, and 124px at their intended breakpoints.

- [ ] **Step 5: Verify restart behavior manually**

With Buffett and another master containing progress:

1. Cancel the confirmation and verify no change.
2. Confirm restart and verify Buffett returns to chapter 1.
3. Verify the other master's progress remains.
4. Verify Buffett journal entries remain.

- [x] **Step 6: Update handoff notes**

Document the active-row rule, spacing values, reset scope, tests, and responsive evidence in `docs/HANDOFF.md`. Do not commit or push.
