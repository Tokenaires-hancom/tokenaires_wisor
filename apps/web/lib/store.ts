"use client";

/** 사용자 데이터 저장소.
 *
 * MVP는 브라우저에만 저장한다. 2번(백엔드·플랫폼) 담당이 Supabase를 붙일 때
 * 이 파일의 함수 본문만 교체하면 되도록 화면 코드와 저장 방식을 분리해 둔다.
 * 화면은 아래 함수 외의 저장 수단을 직접 쓰지 않는다.
 *
 * 모든 함수가 Promise를 돌려주는 이유: Supabase 클라이언트는 전부 비동기다.
 * 지금 동기로 두면 교체 시점에 모든 호출부를 열어야 한다. localStorage는
 * 동기지만 시그니처를 미리 맞춰 둔다.
 */

export type NoteStatus = "first" | "digging" | "learned" | "watching" | "dropped";

export const NOTE_STATUS_LABEL: Record<NoteStatus, string> = {
  first: "처음 확인",
  digging: "추가 조사 필요",
  learned: "학습 완료",
  watching: "관찰 중",
  dropped: "관심 제외",
};

export type StudyNote = {
  ticker: string;
  name: string;
  whyInterested: string;
  styleScores: { styleId: string; label: string; score: number | null }[];
  strengths: string[];
  risks: string[];
  chartObservations: string[];
  openQuestions: string;
  status: NoteStatus;
  updatedAt: string;
};

export type Progress = {
  lessonsDone: string[];
  quizResults: Record<string, { correct: number; total: number; at: string }>;
};

const KEYS = {
  watchlist: "wisor.watchlist",
  notes: "wisor.notes",
  progress: "wisor.progress",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("wisor:store"));
  } catch {
    /* 저장 공간이 가득 찬 경우 화면 동작은 그대로 둔다 */
  }
}

/* 관심종목 */

export async function getWatchlist(): Promise<string[]> {
  return read<string[]>(KEYS.watchlist, []);
}

export async function isWatched(ticker: string): Promise<boolean> {
  return (await getWatchlist()).includes(ticker);
}

/** 담긴 상태를 뒤집고, 뒤집은 뒤의 상태를 돌려준다. */
export async function toggleWatch(ticker: string): Promise<boolean> {
  const list = await getWatchlist();
  const next = list.includes(ticker) ? list.filter((t) => t !== ticker) : [...list, ticker];
  write(KEYS.watchlist, next);
  return next.includes(ticker);
}

/* 학습노트 */

export async function getNotes(): Promise<StudyNote[]> {
  return read<StudyNote[]>(KEYS.notes, []);
}

export async function getNote(ticker: string): Promise<StudyNote | undefined> {
  return (await getNotes()).find((n) => n.ticker === ticker);
}

export async function saveNote(note: Omit<StudyNote, "updatedAt">): Promise<StudyNote> {
  const saved: StudyNote = { ...note, updatedAt: new Date().toISOString() };
  const rest = (await getNotes()).filter((n) => n.ticker !== note.ticker);
  write(KEYS.notes, [saved, ...rest]);
  return saved;
}

export async function deleteNote(ticker: string): Promise<void> {
  const rest = (await getNotes()).filter((n) => n.ticker !== ticker);
  write(KEYS.notes, rest);
}

/* 학습 진도 */

export async function getProgress(): Promise<Progress> {
  return read<Progress>(KEYS.progress, { lessonsDone: [], quizResults: {} });
}

export async function markLessonDone(id: string): Promise<void> {
  const p = await getProgress();
  if (!p.lessonsDone.includes(id)) p.lessonsDone.push(id);
  write(KEYS.progress, p);
}

export async function recordQuiz(id: string, correct: number, total: number): Promise<void> {
  const p = await getProgress();
  p.quizResults[id] = { correct, total, at: new Date().toISOString() };
  if (!p.lessonsDone.includes(id)) p.lessonsDone.push(id);
  write(KEYS.progress, p);
}
