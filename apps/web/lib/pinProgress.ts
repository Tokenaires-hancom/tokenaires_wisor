/** 화면에 붙잡힌 섹션을 얼마나 지나왔는지를 0~1로 준다.
 *
 *  outerTop  붙잡는 통의 getBoundingClientRect().top
 *  pinnable  통 높이에서 섹션 높이를 뺀 값 — 붙잡혀 있는 동안 실제로 스크롤되는 길이
 *
 *  통 위가 화면 상단에 닿기 전에는 0, 다 지나가면 1이다. DOM을 모르는 함수라
 *  브라우저 없이 검사할 수 있다. */
export function pinProgress(outerTop: number, pinnable: number): number {
  if (!(pinnable > 0)) return 0;
  const p = -outerTop / pinnable;
  /* p > 0이 아닌 경우로 묶으면 음수와 NaN과 -0을 한 번에 걸러 0을 준다.
     outerTop이 0일 때 -0/양수 = -0이라 p < 0으로는 걸리지 않는다. */
  if (!(p > 0)) return 0;
  if (p > 1) return 1;
  return p;
}
