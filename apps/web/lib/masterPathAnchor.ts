export function getCharacterAnchor(nextNo: number | undefined): number {
  if (nextNo === undefined || nextNo >= 4) return 5;
  if (nextNo === 3) return 3;
  return 2;
}
