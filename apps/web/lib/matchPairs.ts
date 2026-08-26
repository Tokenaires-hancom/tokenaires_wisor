/** 짝맞추기 순수 로직 — 용어(term)와 정의(def)를 짝짓는다. DOM을 모른다. */

export type Side = "term" | "def";
export type PairItem = { pairId: number; side: Side; text: string };

/** 두 항목이 같은 짝의 양쪽(용어+정의)이면 매치. 같은 쪽끼리는 아니다. */
export function isMatch(a: PairItem, b: PairItem): boolean {
  return a.pairId === b.pairId && a.side !== b.side;
}

/** 맞춘 짝 수가 전체와 같으면 완료. */
export function isComplete(matched: Set<number>, total: number): boolean {
  return matched.size >= total;
}
