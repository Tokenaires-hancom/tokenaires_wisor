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

/** lessonsDone(완료 순서 로그)을 뒤에서부터 훑어, candidateIds 중 가장 최근에
 *  끝낸 챕터의 masterId를 찾는다. "master:{id}:{chapter}" 형태만 본다. */
function lastActiveMasterId(lessonsDone: string[], candidateIds: Set<string>): string | undefined {
  for (let i = lessonsDone.length - 1; i >= 0; i -= 1) {
    const [kind, masterId] = lessonsDone[i].split(":");
    if (kind === "master" && candidateIds.has(masterId)) return masterId;
  }
  return undefined;
}

/** 코인 마스코트가 서는 건물 칸. 진행 중인 건물(0<완료<5)이 여럿이면 그중
 *  가장 최근에 챕터를 끝낸 건물 위. 진행 중인 게 없으면, 완료된 건물이
 *  하나라도 있을 때는 null(마스코트 없음 — 완료된 건물엔 깃발만 남는다),
 *  아무 진행도 없을 때만 첫 칸에 선다. 레벨이 아니라 실제 진행 상태를 따라간다. */
export function townMascotPlot(rows: MasterProgressRow[], lessonsDone: string[] = []): number | null {
  const inProgress = rows.filter((r) => r.done > 0 && !r.complete);
  if (inProgress.length > 0) {
    const candidateIds = new Set(inProgress.map((r) => r.masterId));
    const targetId = lastActiveMasterId(lessonsDone, candidateIds) ?? inProgress[0].masterId;
    return rows.findIndex((r) => r.masterId === targetId);
  }
  if (rows.some((r) => r.complete)) return null;
  return 0;
}

/** 가장 최근에 완공된 건물 칸. 마이페이지에 들어올 때마다 그 건물 깃발
 *  뒤에서 한 번만 축하 불꽃이 튄다 — 완공된 게 여럿이어도 하나만 터뜨려
 *  화면이 어지러워지지 않게 한다. 완공된 건물이 없으면 null. */
export function townLastCompletedPlot(rows: MasterProgressRow[], lessonsDone: string[] = []): number | null {
  const complete = rows.filter((r) => r.complete);
  if (complete.length === 0) return null;
  const candidateIds = new Set(complete.map((r) => r.masterId));
  const targetId = lastActiveMasterId(lessonsDone, candidateIds) ?? complete[complete.length - 1].masterId;
  return rows.findIndex((r) => r.masterId === targetId);
}
