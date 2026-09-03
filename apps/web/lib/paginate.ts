/** 목록을 페이지로 자르는 계산.
 *
 *  컴포넌트가 아니라 여기 있는 이유는 `npm test`가 `content/**`와 `lib/**`만 돌기
 *  때문이다. 경계(0개 · 딱 나누어떨어지는 수 · 범위 밖 페이지)를 테스트로 증명할
 *  수 있는 자리에 둔다.
 */

/** 한 페이지에 놓는 종목 수. 화면 높이와 무관하게 고정한다.
 *  높이를 따라 줄 수가 변하면 `3 / 26`이라는 표시를 믿을 수 없게 된다 —
 *  같은 종목이 어제는 3페이지, 오늘은 4페이지에 있게 된다. */
export const PAGE_SIZE = 14;

/** 0개짜리 목록도 1페이지다. `0 / 0`이라고 쓰면 읽는 쪽이 오류로 본다. */
export function pageCount(total: number, size: number = PAGE_SIZE): number {
  if (size <= 0) return 1;
  return Math.max(1, Math.ceil(total / size));
}

/** page는 1부터 센다. 범위 밖이면 가장 가까운 끝 페이지로 붙인다 —
 *  빈 화면을 보여주는 것보다 낫다. */
export function pageSlice<T>(items: T[], page: number, size: number = PAGE_SIZE): T[] {
  if (size <= 0) return [];
  const last = pageCount(items.length, size);
  const safe = Math.min(Math.max(Math.trunc(page), 1), last);
  const start = (safe - 1) * size;
  return items.slice(start, start + size);
}
