import type { Master } from "../content/masters.ts";
import type { MasterProgressRow } from "./gamification.ts";

/** 마을 장식은 레벨에서만 온다. 가상 현금으로 사는 아이템이 아니다. */

/** 건물 아래 짧은 이름. 성을 떼고 부를 때 쓰는 이름만 고른다. */
const TOWN_LABEL: Record<Master["id"], string> = {
  buffett: "버핏",
  graham: "그레이엄",
  lynch: "린치",
  marks: "막스",
  fisher: "피셔",
  greenblatt: "그린블랫",
  soros: "소로스",
};

export function townMasterLabel(masterId: string): string {
  return TOWN_LABEL[masterId as Master["id"]] ?? masterId;
}

export type TownScenery = {
  path: boolean;
  bench: boolean;
};

/** Lv1은 빈 터. 길은 3, 벤치는 5. */
export function townScenery(level: number): TownScenery {
  const lvl = Math.max(1, level);
  return {
    path: lvl >= 3,
    bench: lvl >= 5,
  };
}

/** 코인 마스코트가 서는 건물 칸. 진행 중인 건물(0<완료<5) 위, 없으면 마지막으로
 *  완성한 건물 위, 그마저 없으면 첫 칸. 레벨이 아니라 실제 진행 상태를 따라간다. */
export function townMascotPlot(rows: MasterProgressRow[]): number {
  const inProgress = rows.findIndex((r) => r.done > 0 && !r.complete);
  if (inProgress >= 0) return inProgress;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].complete) return i;
  }
  return 0;
}
