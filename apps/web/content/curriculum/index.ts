import type { Master } from "../masters";
import { BUFFETT } from "./buffett";
import { GRAHAM } from "./graham";
import { LYNCH } from "./lynch";
import type { Chapter, Curriculum } from "./types";
import { curriculumProblems } from "./validate";

export * from "./types";

// MASTERS와 같은 순서. 목차 페이지와 스크리너가 이미 이 순서다
export const CURRICULA: Curriculum[] = [BUFFETT, GRAHAM, LYNCH];

// 페이지가 전부 정적 생성이라 이 검사는 빌드에서 돈다. 건너뛸 수 없다.
const problems = curriculumProblems(CURRICULA);
if (problems.length > 0) {
  throw new Error(`커리큘럼에 문제가 있습니다:\n- ${problems.join("\n- ")}`);
}

export const CURRICULUM_BY_MASTER = Object.fromEntries(
  CURRICULA.map((c) => [c.masterId, c]),
) as Record<Master["id"], Curriculum>;

export function chapterOf(masterId: string, no: number): Chapter | undefined {
  return CURRICULUM_BY_MASTER[masterId as Master["id"]]?.chapters[no - 1];
}
