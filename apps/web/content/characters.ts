/** 대가별 캐릭터 에셋 유무와 경로.
 *
 *  masters.ts를 건드리지 않는 이유: 그 파일은 화면과 데이터 파이프라인이
 *  함께 참조하는 콘텐츠 정의다. 에셋이 그려졌는지는 화면에만 필요한
 *  사실이므로 타입을 늘리지 않고 옆에 둔다.
 *
 *  새 캐릭터를 그리면 public/characters/<id>/ 에 같은 파일 이름으로 넣고
 *  아래 배열에 id 한 줄을 더한다. */

const STAND_READY = ["buffett", "graham", "lynch", "fisher", "greenblatt", "marks", "soros"];
const GUIDE_READY = ["buffett"];

export function hasCharacter(id: string): boolean {
  return STAND_READY.includes(id);
}

export function characterStand(id: string): string | null {
  return hasCharacter(id) ? `/characters/${id}/stand.webp` : null;
}

export function characterGuide(id: string): string | null {
  return GUIDE_READY.includes(id) ? `/characters/${id}/guide.webp` : null;
}
