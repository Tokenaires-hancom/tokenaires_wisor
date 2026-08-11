import type { Curriculum } from "./types.ts";

/** 사용자에게 보이는 문장에서 막는 표현.
 *  이 제품은 관찰과 확인 사항까지만 말한다. 권유하지 않는다. */
const BANNED = ["지금 사", "지금 파", "손절하", "추천합니다", "확실합니다", "보장합니다"];

/** 타입이 잡지 못하는 것만 본다. 문제를 전부 모아 메시지 배열로 돌려준다. */
export function curriculumProblems(curricula: Curriculum[]): string[] {
  const problems: string[] = [];

  for (const curriculum of curricula) {
    curriculum.chapters.forEach((chapter, index) => {
      const where = `${curriculum.masterId} ${index + 1}장`;

      if (chapter.body.length === 0) {
        problems.push(`${where}: 본문이 비어 있습니다.`);
      }

      const text = [chapter.title, chapter.lede, ...chapter.body].join(" ");
      for (const banned of BANNED) {
        if (text.includes(banned)) {
          problems.push(`${where}: 권유형 표현 '${banned}'가 본문에 있습니다.`);
        }
      }

      chapter.exercises.forEach((exercise, position) => {
        const at = `${where} ${position + 1}번 문항`;

        const exerciseText =
          exercise.kind === "graded"
            ? [exercise.prompt, ...exercise.choices, exercise.explain].join(" ")
            : exercise.kind === "guided"
              ? [exercise.prompt, ...exercise.checkpoints].join(" ")
              : exercise.prompt;

        for (const banned of BANNED) {
          if (exerciseText.includes(banned)) {
            problems.push(`${at}: 권유형 표현 '${banned}'가 있습니다.`);
          }
        }

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
