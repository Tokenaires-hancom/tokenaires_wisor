import type { Company, StyleMeta } from "./scores.types";

/** 판정 불가가 이 비율을 넘으면 점수를 만들지 않는다.
 *
 * data-pipeline/wisor_data/styles/base.py의 규칙과 같은 값이다. 여기서는 그 규칙을
 * 사람에게 설명하기 위해 다시 쓴다. 한쪽을 바꾸면 다른 쪽도 바꿔야 한다.
 */
export const UNKNOWN_LIMIT = 0.25;

export type StyleCoverage = {
  styleId: string;
  criteriaCount: number;
  /** 기준 몇 개까지 비어도 점수가 나오는가. 기준이 적은 철학일수록 작다. */
  allowedUnknown: number;
  scored: number;
  unscored: number;
  unscorable: number;
  /** 점수를 못 낸 종목에서 가장 자주 비어 있던 기준 */
  topMissing: { code: string; label: string; count: number }[];
};

export type Coverage = {
  universe: number;
  /** 업종 때문에 판정하지 않은 종목. 모든 철학에 공통이다. */
  unscorable: number;
  byStyle: StyleCoverage[];
};

export function styleCoverage(companies: Company[], styles: StyleMeta[]): Coverage {
  return {
    universe: companies.length,
    unscorable: companies.filter((c) => c.scorable === false).length,
    byStyle: styles.map((style) => {
      const judged = companies.filter(
        (c) => c.scores[style.id]?.dataConfidence !== "판정 대상 아님" && c.scorable !== false
      );
      const unscorable = companies.length - judged.length;
      const scored = judged.filter((c) => c.scores[style.id]?.score !== null);
      const unscored = judged.filter((c) => c.scores[style.id]?.score === null);

      const missing = new Map<string, number>();
      for (const company of unscored) {
        for (const criterion of company.scores[style.id]?.criteria ?? []) {
          if (criterion.status === "unknown") {
            missing.set(criterion.code, (missing.get(criterion.code) ?? 0) + 1);
          }
        }
      }
      const label = new Map(style.criteria.map((c) => [c.code, c.label]));

      return {
        styleId: style.id,
        criteriaCount: style.criteria.length,
        allowedUnknown: Math.floor(style.criteria.length * UNKNOWN_LIMIT),
        scored: scored.length,
        unscored: unscored.length,
        unscorable,
        topMissing: [...missing.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, 2)
          .map(([code, count]) => ({ code, label: label.get(code) ?? code, count })),
      };
    }),
  };
}
