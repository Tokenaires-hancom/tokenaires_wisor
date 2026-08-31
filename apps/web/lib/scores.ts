/** 서버 전용 데이터 접근.
 *
 * 운영 서버에서는 SCORES_JSON_PATH가 가리키는 런타임 파일을 읽는다. 파일이
 * 바뀌지 않은 동안에는 메모리의 파싱 결과를 재사용하고, 배치가 원자적으로 파일을
 * 교체하면 다음 요청이 새 스냅샷을 읽는다.
 *
 * 클라이언트에 필요한 데이터는 서버 컴포넌트에서 props로 내려보낸다.
 */

import { existsSync, readFileSync, statSync, type Stats } from "node:fs";
import path from "node:path";
import { styleCoverage, type Coverage } from "./coverage.ts";
import { rank, type Ranking } from "./ranking.ts";
import type { Company, ScoresPayload, StyleMeta } from "./scores.types.ts";

export type {
  Company,
  CriterionResult,
  CriterionStatus,
  ScoresPayload,
  StyleMeta,
  StyleScore,
} from "./scores.types.ts";
export { METRIC_LABELS } from "./scores.types.ts";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/scores.ts는 서버 전용입니다. 클라이언트 컴포넌트는 lib/scores.types.ts에서 " +
      "타입을 가져오고, 데이터는 서버 컴포넌트에서 props로 받으세요."
  );
}

type ScoresCache = {
  path: string;
  version: string;
  data: ScoresPayload;
};

let cache: ScoresCache | undefined;
let rejected: { path: string; version: string } | undefined;

function fileVersion(stats: Stats): string {
  return [stats.dev, stats.ino, stats.size, stats.mtimeMs, stats.ctimeMs].join(":");
}

function defaultPaths(): string[] {
  return [
    path.resolve(process.cwd(), "lib", "generated", "scores.json"),
    path.resolve(process.cwd(), "apps", "web", "lib", "generated", "scores.json"),
  ];
}

export function resolveScoresPath(pathOverride?: string): string {
  const configured = pathOverride ?? process.env.SCORES_JSON_PATH;
  if (configured) return path.resolve(configured);

  const found = defaultPaths().find(existsSync);
  if (found) return found;
  if (cache) return cache.path;

  throw new Error(
    `scores.json을 찾지 못했습니다. SCORES_JSON_PATH를 설정하세요. 찾아본 곳: ${defaultPaths().join(
      ", "
    )}`
  );
}

function parseScores(raw: string, filePath: string): ScoresPayload {
  const payload: unknown = JSON.parse(raw);
  if (!payload || typeof payload !== "object") {
    throw new Error(`${filePath}의 scores.json 구조가 올바르지 않습니다.`);
  }
  const candidate = payload as ScoresPayload;
  const validTopLevel =
    typeof candidate.generatedAt === "string" &&
    Boolean(candidate.generatedAt) &&
    typeof candidate.dataSource === "string" &&
    Boolean(candidate.dataSource) &&
    candidate.asOf &&
    typeof candidate.asOf.price === "string" &&
    typeof candidate.asOf.financial === "string" &&
    Array.isArray(candidate.styles) &&
    candidate.styles.length > 0 &&
    Array.isArray(candidate.companies) &&
    candidate.companies.length > 0;
  if (!validTopLevel) {
    throw new Error(`${filePath}의 scores.json 필수 값이 비어 있습니다.`);
  }

  const priceAt = candidate.asOf.priceAt;
  const priceCoverage = candidate.asOf.priceCoverage;
  const validPriceMetadata =
    (priceAt === undefined || (typeof priceAt === "string" && Boolean(priceAt))) &&
    (priceCoverage === undefined ||
      (priceAt !== undefined &&
        Number.isInteger(priceCoverage.refreshed) &&
        Number.isInteger(priceCoverage.total) &&
        priceCoverage.refreshed >= 0 &&
        priceCoverage.refreshed <= priceCoverage.total &&
        priceCoverage.total === candidate.companies.length));
  if (!validPriceMetadata) {
    throw new Error(`${filePath}의 가격 갱신 메타데이터가 올바르지 않습니다.`);
  }

  const styleIds = candidate.styles.map((style) =>
    style && typeof style.id === "string" ? style.id : ""
  );
  const normalizedTickers = candidate.companies.map((item) =>
    item && typeof item.ticker === "string" ? item.ticker.toUpperCase() : ""
  );
  const validStyles = candidate.styles.every(
    (style) =>
      style &&
      typeof style.id === "string" &&
      Boolean(style.id) &&
      typeof style.name === "string" &&
      typeof style.modelVersion === "string" &&
      Array.isArray(style.criteria)
  );
  const validCompanies = candidate.companies.every(
    (item) =>
      item &&
      typeof item.ticker === "string" &&
      Boolean(item.ticker) &&
      typeof item.name === "string" &&
      Number.isFinite(item.price) &&
      item.price > 0 &&
      Number.isFinite(item.marketCap) &&
      item.marketCap > 0 &&
      item.asOf &&
      typeof item.asOf.price === "string" &&
      typeof item.asOf.financial === "string" &&
      (item.asOf.priceAt === undefined ||
        (typeof item.asOf.priceAt === "string" && Boolean(item.asOf.priceAt))) &&
      item.metrics &&
      typeof item.metrics === "object" &&
      item.scores &&
      typeof item.scores === "object" &&
      styleIds.every((styleId) => {
        const score = item.scores[styleId];
        return score && typeof score === "object" && Array.isArray(score.criteria);
      })
  );
  const refreshedCount = candidate.companies.filter(
    (item) => item.asOf.priceAt !== undefined
  ).length;
  if (
    !validStyles ||
    new Set(styleIds).size !== styleIds.length ||
    !validCompanies ||
    new Set(normalizedTickers).size !== normalizedTickers.length ||
    (priceCoverage !== undefined &&
      (priceCoverage.refreshed !== refreshedCount ||
        candidate.companies.some(
          (item) =>
            item.asOf.priceAt !== undefined &&
            (item.asOf.priceAt !== priceAt || item.asOf.price !== priceAt?.slice(0, 10))
        )))
  ) {
    throw new Error(`${filePath}의 styles 또는 companies 구조가 올바르지 않습니다.`);
  }
  return candidate;
}

function keepLastGood(filePath: string, version: string, error: unknown): ScoresPayload {
  if (cache?.path !== filePath) throw error;
  if (rejected?.path !== filePath || rejected.version !== version) {
    console.error(`새 scores.json을 읽지 못해 이전 데이터를 유지합니다: ${String(error)}`);
    rejected = { path: filePath, version };
  }
  return cache.data;
}

function unavailableVersion(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return `unavailable:${String((error as { code?: unknown }).code)}`;
  }
  return `unavailable:${String(error)}`;
}

/** 같은 파일은 메모리에서 돌려주고, 원자 교체된 파일만 다시 읽는다. */
export function loadScores(pathOverride?: string): ScoresPayload {
  const filePath = resolveScoresPath(pathOverride);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let beforeVersion: string;
    try {
      beforeVersion = fileVersion(statSync(filePath));
    } catch (error) {
      return keepLastGood(filePath, unavailableVersion(error), error);
    }
    if (cache?.path === filePath && cache.version === beforeVersion) return cache.data;
    if (cache?.path === filePath && rejected?.version === beforeVersion) return cache.data;

    let raw: string;
    let afterVersion: string;
    try {
      raw = readFileSync(filePath, "utf8");
      afterVersion = fileVersion(statSync(filePath));
    } catch (error) {
      return keepLastGood(filePath, unavailableVersion(error), error);
    }
    if (beforeVersion !== afterVersion) continue;

    let data: ScoresPayload;
    try {
      data = parseScores(raw, filePath);
    } catch (error) {
      return keepLastGood(filePath, afterVersion, error);
    }

    cache = { path: filePath, version: afterVersion, data };
    rejected = undefined;
    return data;
  }

  if (cache?.path === filePath) return cache.data;
  throw new Error(`${filePath}이 읽는 동안 계속 바뀌었습니다. 다음 요청에서 다시 시도하세요.`);
}

export function isSampleData(data: ScoresPayload = loadScores()): boolean {
  return data.dataSource === "sample";
}

/** 유니버스 전체가 걸쳐 있는 재무 기준일의 범위. */
export function financialRange(data: ScoresPayload = loadScores()): { from: string; to: string } {
  const dates = data.companies.map((company) => company.asOf.financial).sort();
  return {
    from: dates[0] ?? data.asOf.financial,
    to: dates[dates.length - 1] ?? data.asOf.financial,
  };
}

export function styleMeta(
  styleId: string,
  data: ScoresPayload = loadScores()
): StyleMeta | undefined {
  return data.styles.find((style) => style.id === styleId);
}

export function companies(data: ScoresPayload = loadScores()): Company[] {
  return data.companies;
}

export function company(
  ticker: string,
  data: ScoresPayload = loadScores()
): Company | undefined {
  return data.companies.find((item) => item.ticker.toUpperCase() === ticker.toUpperCase());
}

/** 티커 → 시가총액 순위(1위부터). 순위를 매기려면 유니버스 전체를 정렬해야 하는데
 *  그 계산은 서버에서만 할 수 있다. 종목 상세를 그리는 클라이언트 컴포넌트가
 *  이 결과를 props로 받는다.
 *
 *  시가총액이 숫자가 아닌 종목은 순위에서 뺀다 — 없는 값을 0으로 채우면
 *  꼴찌로 줄을 세우게 된다. 그런 종목은 이 표에 아예 안 들어간다. */
export function marketCapRanks(data: ScoresPayload = loadScores()): Record<string, number> {
  const ordered = data.companies
    .filter((c) => Number.isFinite(c.marketCap))
    .sort((a, b) => b.marketCap - a.marketCap);

  return Object.fromEntries(ordered.map((c, i) => [c.ticker, i + 1]));
}

/** 철학마다 몇 종목을 채점했고 왜 다른지. */
export function coverage(data: ScoresPayload = loadScores()): Coverage {
  return styleCoverage(data.companies, data.styles);
}

/** 점수를 매길 수 없는 종목은 순위에서 빼되, 이유를 나눠 따로 돌려준다. */
export function ranked(styleId: string, data: ScoresPayload = loadScores()): Ranking {
  return rank(data.companies, styleId);
}
