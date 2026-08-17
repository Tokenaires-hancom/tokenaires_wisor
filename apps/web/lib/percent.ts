/** 고른 칸의 구성 비율. 각 항목을 따로 반올림하면 합이 99나 101이 되는데,
 *  나란히 놓고 눈으로 더하는 자리라 그러면 틀린 표로 보인다. 최대잉여법으로
 *  남는 1%씩을 소수부가 큰 쪽에 몰아 합을 100에 맞춘다. */
export function percentShares(counts: number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return counts.map(() => 0);

  const exact = counts.map((count) => (count * 100) / total);
  const shares = exact.map(Math.floor);
  let left = 100 - shares.reduce((sum, share) => sum + share, 0);

  // 소수부가 큰 순서로 나눠 준다. 같으면 앞선 것이 먼저다 — 순서가 흔들리면
  // 같은 선택인데 새로고침마다 비율이 달라 보인다
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const { index } of order) {
    if (left <= 0) break;
    shares[index] += 1;
    left -= 1;
  }

  return shares;
}
