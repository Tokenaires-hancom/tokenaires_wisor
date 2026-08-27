import type { Master } from "../content/masters.ts";

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

/** 코인 마스코트가 서는 건물 칸(0~6). 레벨이 오를수록 한 칸씩 옆으로. */
export function townMascotPlot(level: number): number {
  return Math.min(6, Math.max(0, Math.max(1, level) - 1));
}
