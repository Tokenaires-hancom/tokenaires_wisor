/** 고른 것과 정답이 집합으로 같은지 본다. 고른 순서는 보지 않는다. */
export function isCorrect(answers: number[], picked: number[]): boolean {
  return answers.length === picked.length && answers.every((answer) => picked.includes(answer));
}
