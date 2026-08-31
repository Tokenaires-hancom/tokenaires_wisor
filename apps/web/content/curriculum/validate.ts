import { CHAPTER_SLOTS, SOURCE_KINDS, type Curriculum } from "./types.ts";

/** 비교표 칸 하나에 들어가는 최대 길이. 넘으면 칸이 세 줄을 넘겨 표가 한 화면에
 *  들어오지 않는다. 한눈에 견주는 것이 이 표의 전부라 길이가 곧 기능이다. */
const ONE_LINE_MAX = 24;

/** 타입이 잡지 못하는 것만 본다. 문제를 전부 모아 메시지 배열로 돌려준다. */
export function curriculumProblems(curricula: Curriculum[]): string[] {
  const problems: string[] = [];

  for (const curriculum of curricula) {
    if (curriculum.primarySources.length === 0) {
      problems.push(`${curriculum.masterId}: 근거 자료 목록이 비어 있습니다.`);
    }

    curriculum.chapters.forEach((chapter, index) => {
      const where = `${curriculum.masterId} ${index + 1}장`;

      if (chapter.body.length === 0) {
        problems.push(`${where}: 본문이 비어 있습니다.`);
      }

      // 출처 없는 서술을 남기지 않는다. 이 제품이 대가의 말과 이 과정의 말을
      // 가려 주기로 한 약속이 여기서 강제된다.
      if (chapter.sources.length === 0) {
        problems.push(`${where}: 출처가 비어 있습니다.`);
      }

      // 비교표에 나가는 칸에만 oneLine이 있어야 한다. 짝이 어긋나면 표에 빈 칸이
      // 생기거나, 아무 데도 안 쓰이는 문장이 남는다
      const pickable = "picks" in CHAPTER_SLOTS[index];
      if (pickable && chapter.oneLine === undefined) {
        problems.push(`${where}: 비교표에 나가는 칸인데 oneLine이 없습니다.`);
      }
      if (!pickable && chapter.oneLine !== undefined) {
        problems.push(`${where}: 비교표에 나가지 않는 칸인데 oneLine이 있습니다.`);
      }

      if (chapter.oneLine !== undefined) {
        const at = `${where} oneLine`;

        if (chapter.oneLine.trim() === "") {
          problems.push(`${at}: 비어 있습니다.`);
        }
        if (chapter.oneLine.length > ONE_LINE_MAX) {
          problems.push(
            `${at}: ${chapter.oneLine.length}자로 ${ONE_LINE_MAX}자를 넘습니다.`,
          );
        }
        // 표 안의 짧은 문장이라 마침표를 찍지 않는다. 스물여덟 칸이 섞이면 눈에 띈다
        if (chapter.oneLine.endsWith(".")) {
          problems.push(`${at}: 마침표로 끝납니다.`);
        }
      }

      chapter.sources.forEach((source, order) => {
        const at = `${where} ${order + 1}번 출처`;

        if (source.text.trim() === "") {
          problems.push(`${at}: 내용이 비어 있습니다.`);
        }

        if (!SOURCE_KINDS.includes(source.kind)) {
          problems.push(`${at}: 알 수 없는 유형 '${source.kind}'입니다.`);
        }

        // 본문을 고치고 각주를 안 고치면 엉뚱한 문단에 출처가 붙는다.
        if (source.paragraph !== undefined) {
          if (!Number.isInteger(source.paragraph) || source.paragraph < 0) {
            problems.push(`${at}: 문단 번호 ${source.paragraph}가 올바르지 않습니다.`);
          } else if (source.paragraph >= chapter.body.length) {
            problems.push(
              `${at}: 문단 번호 ${source.paragraph}가 본문 ${chapter.body.length}문단의 범위 밖입니다.`,
            );
          }
        }
      });

      chapter.exercises.forEach((exercise, position) => {
        const at = `${where} ${position + 1}번 문항`;

        if (exercise.kind === "graded") {
          if (exercise.answers.length === 0) {
            problems.push(`${at}: 정답이 지정되지 않았습니다.`);
          }
          for (const answer of exercise.answers) {
            if (answer < 0 || answer >= exercise.choices.length) {
              // 범위 밖 인덱스는 조용히 오답을 정답으로 가르친다
              problems.push(
                `${at}: 정답 인덱스 ${answer}가 선택지 ${exercise.choices.length}개의 범위 밖입니다.`,
              );
            }
          }
        }

        if (exercise.kind === "guided" && exercise.checkpoints.length === 0) {
          problems.push(`${at}: 체크 포인트가 비어 있습니다.`);
        }
      });
    });
  }

  return problems;
}
