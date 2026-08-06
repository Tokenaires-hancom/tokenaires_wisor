import type { Company } from "./scores.types";

/** 점수를 낼 수 없는 이유는 두 가지고, 사용자에게 전혀 다른 정보다.
 *
 * - unscored   판정에 필요한 데이터가 모자란다
 * - unscorable 업종이 현재 모델의 전제와 달라 판정하지 않는다(은행·보험·부동산)
 *
 * 둘을 한 덩어리로 묶으면 은행에 대고 '데이터가 모자랍니다'라고 말하게 된다.
 * 데이터는 다 있고, 맞지 않는 것은 모델 쪽이다.
 */
export type Ranking = {
  scored: Company[];
  unscored: Company[];
  unscorable: Company[];
};

export function rank(companies: Company[], styleId: string): Ranking {
  const result: Ranking = { scored: [], unscored: [], unscorable: [] };

  for (const c of companies) {
    const s = c.scores[styleId];
    if (c.scorable === false) result.unscorable.push(c);
    else if (!s || s.score === null) result.unscored.push(c);
    else result.scored.push(c);
  }

  result.scored.sort((a, b) => {
    const aScore = a.scores[styleId];
    const bScore = b.scores[styleId];
    if (aScore.rank !== undefined && bScore.rank !== undefined) {
      return aScore.rank - bScore.rank || a.ticker.localeCompare(b.ticker);
    }
    return (bScore.score ?? 0) - (aScore.score ?? 0);
  });

  return result;
}
