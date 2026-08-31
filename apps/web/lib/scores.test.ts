import assert from "node:assert/strict";
import { mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { loadScores } from "./scores.ts";
import type { ScoresPayload } from "./scores.types.ts";

function payload(generatedAt: string): ScoresPayload {
  return {
    generatedAt,
    dataSource: "sec-toss",
    asOf: { price: "2026-08-25", financial: "2026-06-30" },
    styles: [
      {
        id: "buffett",
        name: "버핏",
        modelVersion: "Buffett 1.0",
        method: "threshold",
        criteria: [],
      },
    ],
    companies: [
      {
        ticker: "TEST",
        name: "테스트",
        sector: "테스트",
        price: 10,
        marketCap: 100,
        asOf: { price: "2026-08-25", financial: "2026-06-30" },
        metrics: {},
        scores: {
          buffett: {
            styleId: "buffett",
            modelVersion: "Buffett 1.0",
            score: null,
            passed: 0,
            totalJudged: 0,
            total: 0,
            dataConfidence: "정보 부족",
            criteria: [],
            reasons: [],
            risks: [],
          },
        },
      },
    ],
  };
}

function writeScores(filePath: string, data: ScoresPayload): void {
  writeFileSync(filePath, JSON.stringify(data), "utf8");
}

test("같은 런타임 파일은 파싱한 스냅샷을 재사용한다", (context) => {
  const dir = mkdtempSync(path.join(tmpdir(), "wisor-scores-"));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "scores.json");
  writeScores(filePath, payload("2026-08-26T00:00:00+00:00"));

  const first = loadScores(filePath);

  assert.strictEqual(loadScores(filePath), first);
});

test("원자 교체된 런타임 파일은 다음 조회에서 다시 읽는다", (context) => {
  const dir = mkdtempSync(path.join(tmpdir(), "wisor-scores-"));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "scores.json");
  const replacement = path.join(dir, ".scores.json.new");
  writeScores(filePath, payload("2026-08-26T00:00:00+00:00"));
  const first = loadScores(filePath);

  writeScores(replacement, payload("2026-08-26T01:00:00+00:00"));
  renameSync(replacement, filePath);
  const second = loadScores(filePath);

  assert.notStrictEqual(second, first);
  assert.equal(second.generatedAt, "2026-08-26T01:00:00+00:00");
});

test("잘못된 교체 파일은 마지막 정상 스냅샷을 유지한다", (context) => {
  const dir = mkdtempSync(path.join(tmpdir(), "wisor-scores-"));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "scores.json");
  const replacement = path.join(dir, ".scores.json.new");
  writeScores(filePath, payload("2026-08-26T00:00:00+00:00"));
  const first = loadScores(filePath);

  writeFileSync(replacement, "{", "utf8");
  renameSync(replacement, filePath);

  assert.strictEqual(loadScores(filePath), first);
});

test("런타임 파일이 잠시 사라져도 마지막 정상 스냅샷을 유지한다", (context) => {
  const dir = mkdtempSync(path.join(tmpdir(), "wisor-scores-"));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "scores.json");
  writeScores(filePath, payload("2026-08-26T00:00:00+00:00"));
  const first = loadScores(filePath);

  unlinkSync(filePath);

  assert.strictEqual(loadScores(filePath), first);
});

test("파싱 가능한 빈 교체 파일도 마지막 정상 스냅샷으로 승격하지 않는다", (context) => {
  const dir = mkdtempSync(path.join(tmpdir(), "wisor-scores-"));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "scores.json");
  const replacement = path.join(dir, ".scores.json.new");
  writeScores(filePath, payload("2026-08-26T00:00:00+00:00"));
  const first = loadScores(filePath);

  writeFileSync(
    replacement,
    JSON.stringify({
      generatedAt: "2026-08-26T01:00:00+00:00",
      dataSource: "sec-toss",
      asOf: {},
      styles: [],
      companies: [],
    }),
    "utf8"
  );
  renameSync(replacement, filePath);

  assert.strictEqual(loadScores(filePath), first);
});

test("첫 파일부터 계약이 깨졌으면 실패한다", (context) => {
  const dir = mkdtempSync(path.join(tmpdir(), "wisor-scores-"));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "scores.json");
  writeFileSync(filePath, "{}", "utf8");

  assert.throws(() => loadScores(filePath), /필수 값/);
});

test("잘못된 priceAt 메타데이터도 마지막 정상 스냅샷을 유지한다", (context) => {
  const dir = mkdtempSync(path.join(tmpdir(), "wisor-scores-"));
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "scores.json");
  const replacement = path.join(dir, ".scores.json.new");
  const firstPayload = payload("2026-08-26T00:00:00+00:00");
  writeScores(filePath, firstPayload);
  const first = loadScores(filePath);

  const broken = payload("2026-08-26T01:00:00+00:00");
  (broken.asOf as { priceAt: unknown }).priceAt = 123;
  writeFileSync(replacement, JSON.stringify(broken), "utf8");
  renameSync(replacement, filePath);

  assert.strictEqual(loadScores(filePath), first);
});

for (const field of ["price", "marketCap"] as const) {
  test(`0 이하 ${field} 교체 파일도 마지막 정상 스냅샷을 유지한다`, (context) => {
    const dir = mkdtempSync(path.join(tmpdir(), "wisor-scores-"));
    context.after(() => rmSync(dir, { recursive: true, force: true }));
    const filePath = path.join(dir, "scores.json");
    const replacement = path.join(dir, ".scores.json.new");
    writeScores(filePath, payload("2026-08-26T00:00:00+00:00"));
    const first = loadScores(filePath);

    const broken = payload("2026-08-26T01:00:00+00:00");
    broken.companies[0][field] = 0;
    writeScores(replacement, broken);
    renameSync(replacement, filePath);

    assert.strictEqual(loadScores(filePath), first);
  });
}
