"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/** 사용자 데이터 저장소.
 * 로그인 전에는 localStorage에 임시 저장한다. 로그인 세션을 발견하면 임시 기록을
 * Supabase에서 한 번에 병합하고, 서버 반영이 성공한 뒤에만 로컬 원본을 지운다.
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
  openQuestions: string;
  status: NoteStatus;
  updatedAt: string;
};

export type Progress = {
  lessonsDone: string[];
  quizResults: Record<string, { correct: number; total: number; at: string }>;
};

export type JournalEntry = {
  responseId: string;
  id: string;
  prompt: string;
  text: string;
  at: string;
};

type StoredJournalEntry = Omit<JournalEntry, "responseId"> & { responseId?: string };

export type LearningStorageMode = "browser" | "account";

export type LocalLearningState = {
  watchlist: string[];
  notes: StudyNote[];
  progress: Progress;
  journal: JournalEntry[];
};

const KEYS = {
  watchlist: "wisor.watchlist",
  notes: "wisor.notes",
  progress: "wisor.progress",
  journal: "wisor.journal",
} as const;

const emptyProgress = (): Progress => ({ lessonsDone: [], quizResults: {} });

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function emitStoreChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wisor:store"));
}

function write(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
  try {
    emitStoreChange();
  } catch {
    /* 저장은 끝났으므로 화면 갱신 이벤트 실패를 저장 실패로 바꾸지 않는다. */
  }
  return true;
}

function readLocalState(): LocalLearningState {
  return {
    watchlist: read<string[]>(KEYS.watchlist, []),
    notes: read<StudyNote[]>(KEYS.notes, []),
    progress: read<Progress>(KEYS.progress, emptyProgress()),
    journal: readLocalJournal(),
  };
}

export function hasLearningState(state: LocalLearningState): boolean {
  return (
    state.watchlist.length > 0 ||
    state.notes.length > 0 ||
    state.progress.lessonsDone.length > 0 ||
    Object.keys(state.progress.quizResults).length > 0 ||
    state.journal.length > 0
  );
}

function clearLocalState(): void {
  if (typeof window === "undefined") return;
  Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
  emitStoreChange();
}

type RemoteContext = { supabase: SupabaseClient; userId: string };
let preparedUserId: string | null = null;
let preparation: Promise<boolean> | null = null;

async function migrateLocalState(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const local = readLocalState();
  if (!hasLearningState(local)) return true;

  // 기록 이력을 새 복합키로 먼저 저장한다. 구 스키마에서는 이 요청 자체가 실패하므로
  // 예전 RPC가 (user_id, entry_id) 기준으로 기존 답을 덮어쓸 기회를 주지 않는다.
  if (local.journal.length > 0) {
    const { error: journalError } = await supabase.from("journal_entries").upsert(
      local.journal.map((entry) => ({
        user_id: userId,
        response_id: entry.responseId,
        entry_id: entry.id,
        prompt: entry.prompt,
        answer: entry.text,
        answered_at: entry.at,
      })),
      { onConflict: "user_id,response_id", ignoreDuplicates: true },
    );
    if (journalError) {
      console.error(
        "Wisor journal migration preflight failed",
        journalError.code ?? journalError.message,
      );
      return false;
    }
  }

  const { error } = await supabase.rpc("import_learning_state", {
    p_watchlist: local.watchlist,
    p_notes: local.notes,
    p_progress: local.progress,
    p_journal: [],
  });
  if (error) {
    console.error("Wisor learning state migration failed", error.code ?? error.message);
    return false;
  }
  clearLocalState();
  return true;
}

async function remoteContext(): Promise<RemoteContext | null> {
  if (typeof window === "undefined") return null;
  const { createClient } = await import("./supabase/client.ts");
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  if (preparedUserId !== data.user.id || !preparation) {
    preparedUserId = data.user.id;
    preparation = migrateLocalState(supabase, data.user.id);
  }
  if (!(await preparation)) {
    invalidateRemotePreparation();
    return null;
  }
  return { supabase, userId: data.user.id };
}

function invalidateRemotePreparation(): void {
  preparedUserId = null;
  preparation = null;
}

function remoteWriteFailed(message: string, error: { code?: string; message: string }): void {
  console.error(message, error.code ?? error.message);
  invalidateRemotePreparation();
}

export async function getStorageMode(): Promise<LearningStorageMode> {
  return (await remoteContext()) ? "account" : "browser";
}

/** 인증 직후 비회원 기록 이전을 시작한다. true면 계정 저장소가 준비됐다. */
export async function syncLearningState(): Promise<boolean> {
  return (await remoteContext()) !== null;
}

/* 관심종목 */

export async function getWatchlist(): Promise<string[]> {
  const remote = await remoteContext();
  if (!remote) return read<string[]>(KEYS.watchlist, []);
  const { data, error } = await remote.supabase
    .from("watchlist")
    .select("ticker")
    .order("added_at", { ascending: true });
  if (error) return read<string[]>(KEYS.watchlist, []);
  return (data ?? []).map((row) => String(row.ticker));
}

export async function isWatched(ticker: string): Promise<boolean> {
  const remote = await remoteContext();
  if (!remote) return read<string[]>(KEYS.watchlist, []).includes(ticker);
  const { data, error } = await remote.supabase
    .from("watchlist")
    .select("ticker")
    .eq("user_id", remote.userId)
    .eq("ticker", ticker)
    .maybeSingle();
  if (error) return read<string[]>(KEYS.watchlist, []).includes(ticker);
  return data !== null;
}

export async function toggleWatch(ticker: string): Promise<boolean> {
  const remote = await remoteContext();
  if (!remote) return toggleLocalWatch(ticker);

  const watched = await isWatched(ticker);
  const query = watched
    ? remote.supabase.from("watchlist").delete().eq("user_id", remote.userId).eq("ticker", ticker)
    : remote.supabase.from("watchlist").insert({ user_id: remote.userId, ticker });
  const { error } = await query;
  if (error) {
    remoteWriteFailed("Wisor watchlist update failed", error);
    return toggleLocalWatch(ticker);
  }
  emitStoreChange();
  return !watched;
}

function toggleLocalWatch(ticker: string): boolean {
  const list = read<string[]>(KEYS.watchlist, []);
  const next = list.includes(ticker) ? list.filter((item) => item !== ticker) : [...list, ticker];
  write(KEYS.watchlist, next);
  return next.includes(ticker);
}

/* 학습노트 */

type NoteRow = {
  ticker: string;
  company_name: string;
  why_interested: string | null;
  style_scores: StudyNote["styleScores"] | null;
  strengths: string[] | null;
  risks: string[] | null;
  open_questions: string | null;
  status: NoteStatus;
  updated_at: string;
};

function noteFromRow(row: NoteRow): StudyNote {
  return {
    ticker: row.ticker,
    name: row.company_name,
    whyInterested: row.why_interested ?? "",
    styleScores: row.style_scores ?? [],
    strengths: row.strengths ?? [],
    risks: row.risks ?? [],
    openQuestions: row.open_questions ?? "",
    status: row.status,
    updatedAt: row.updated_at,
  };
}

export async function getNotes(): Promise<StudyNote[]> {
  const remote = await remoteContext();
  if (!remote) return read<StudyNote[]>(KEYS.notes, []);
  const { data, error } = await remote.supabase
    .from("study_notes")
    .select("ticker,company_name,why_interested,style_scores,strengths,risks,open_questions,status,updated_at")
    .order("updated_at", { ascending: false });
  if (error) return read<StudyNote[]>(KEYS.notes, []);
  return ((data ?? []) as NoteRow[]).map(noteFromRow);
}

export async function getNote(ticker: string): Promise<StudyNote | undefined> {
  return (await getNotes()).find((note) => note.ticker === ticker);
}

export async function saveNote(note: Omit<StudyNote, "updatedAt">): Promise<StudyNote> {
  const saved: StudyNote = { ...note, updatedAt: new Date().toISOString() };
  const remote = await remoteContext();
  if (!remote) {
    saveLocalNote(saved);
    return saved;
  }
  const { error } = await remote.supabase.from("study_notes").upsert(
    {
      user_id: remote.userId,
      ticker: saved.ticker,
      company_name: saved.name,
      why_interested: saved.whyInterested,
      style_scores: saved.styleScores,
      strengths: saved.strengths,
      risks: saved.risks,
      open_questions: saved.openQuestions,
      status: saved.status,
      updated_at: saved.updatedAt,
    },
    { onConflict: "user_id,ticker" },
  );
  if (error) {
    remoteWriteFailed("Wisor study note save failed", error);
    saveLocalNote(saved);
  } else emitStoreChange();
  return saved;
}

function saveLocalNote(saved: StudyNote): void {
  const rest = read<StudyNote[]>(KEYS.notes, []).filter((item) => item.ticker !== saved.ticker);
  write(KEYS.notes, [saved, ...rest]);
}

export async function deleteNote(ticker: string): Promise<void> {
  const remote = await remoteContext();
  if (!remote) {
    write(KEYS.notes, read<StudyNote[]>(KEYS.notes, []).filter((note) => note.ticker !== ticker));
    return;
  }
  const { error } = await remote.supabase
    .from("study_notes")
    .delete()
    .eq("user_id", remote.userId)
    .eq("ticker", ticker);
  if (error) remoteWriteFailed("Wisor study note delete failed", error);
  else emitStoreChange();
}

/* 학습 진도 */

export async function getProgress(): Promise<Progress> {
  const remote = await remoteContext();
  if (!remote) return read<Progress>(KEYS.progress, emptyProgress());
  const [lessons, quizzes] = await Promise.all([
    remote.supabase.from("lesson_progress").select("lesson_id"),
    remote.supabase.from("quiz_results").select("lesson_id,correct,total,taken_at"),
  ]);
  if (lessons.error || quizzes.error) return read<Progress>(KEYS.progress, emptyProgress());
  return {
    lessonsDone: (lessons.data ?? []).map((row) => String(row.lesson_id)),
    quizResults: Object.fromEntries(
      (quizzes.data ?? []).map((row) => [
        String(row.lesson_id),
        { correct: Number(row.correct), total: Number(row.total), at: String(row.taken_at) },
      ]),
    ),
  };
}

export function withoutMasterProgress(progress: Progress, masterId: string): Progress {
  const prefix = `master:${masterId}:`;
  return {
    lessonsDone: progress.lessonsDone.filter((id) => !id.startsWith(prefix)),
    quizResults: Object.fromEntries(
      Object.entries(progress.quizResults).filter(([id]) => !id.startsWith(prefix)),
    ),
  };
}

export async function resetMasterProgress(masterId: string): Promise<void> {
  const remote = await remoteContext();
  if (!remote) {
    write(KEYS.progress, withoutMasterProgress(read(KEYS.progress, emptyProgress()), masterId));
    return;
  }
  const pattern = `master:${masterId}:%`;
  const [lessons, quizzes] = await Promise.all([
    remote.supabase.from("lesson_progress").delete().eq("user_id", remote.userId).like("lesson_id", pattern),
    remote.supabase.from("quiz_results").delete().eq("user_id", remote.userId).like("lesson_id", pattern),
  ]);
  const error = lessons.error ?? quizzes.error;
  if (error) remoteWriteFailed("Wisor progress reset failed", error);
  else emitStoreChange();
}

export async function markLessonDone(id: string): Promise<void> {
  const remote = await remoteContext();
  if (!remote) {
    markLocalLessonDone(id);
    return;
  }
  const { error } = await remote.supabase
    .from("lesson_progress")
    .upsert({ user_id: remote.userId, lesson_id: id }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
  if (error) {
    remoteWriteFailed("Wisor lesson progress save failed", error);
    markLocalLessonDone(id);
  } else emitStoreChange();
}

function markLocalLessonDone(id: string): void {
  const progress = read<Progress>(KEYS.progress, emptyProgress());
  if (!progress.lessonsDone.includes(id)) progress.lessonsDone.push(id);
  write(KEYS.progress, progress);
}

export async function recordQuiz(id: string, correct: number, total: number): Promise<void> {
  const at = new Date().toISOString();
  const remote = await remoteContext();
  if (!remote) {
    recordLocalQuiz(id, correct, total, at);
    return;
  }
  const [quiz, lesson] = await Promise.all([
    remote.supabase.from("quiz_results").upsert(
      { user_id: remote.userId, lesson_id: id, correct, total, taken_at: at },
      { onConflict: "user_id,lesson_id" },
    ),
    remote.supabase.from("lesson_progress").upsert(
      { user_id: remote.userId, lesson_id: id },
      { onConflict: "user_id,lesson_id", ignoreDuplicates: true },
    ),
  ]);
  const error = quiz.error ?? lesson.error;
  if (error) {
    remoteWriteFailed("Wisor quiz result save failed", error);
    recordLocalQuiz(id, correct, total, at);
  } else emitStoreChange();
}

function recordLocalQuiz(id: string, correct: number, total: number, at: string): void {
  const progress = read<Progress>(KEYS.progress, emptyProgress());
  progress.quizResults[id] = { correct, total, at };
  if (!progress.lessonsDone.includes(id)) progress.lessonsDone.push(id);
  write(KEYS.progress, progress);
}

/* 기록형 답 */

function normalizeJournalEntry(entry: StoredJournalEntry): JournalEntry {
  const answeredAt = new Date(entry.at);
  const legacyAnsweredAt = Number.isNaN(answeredAt.getTime()) ? entry.at : answeredAt.toISOString();
  return {
    ...entry,
    responseId: entry.responseId ?? `legacy:${entry.id}:${legacyAnsweredAt}`,
  };
}

export function journalEntriesNewestFirst(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

function readLocalJournal(): JournalEntry[] {
  const entries = read<StoredJournalEntry[]>(KEYS.journal, []).map(normalizeJournalEntry);
  return journalEntriesNewestFirst(entries);
}

export async function getJournal(): Promise<JournalEntry[]> {
  const remote = await remoteContext();
  if (!remote) return readLocalJournal();
  const { data, error } = await remote.supabase
    .from("journal_entries")
    .select("response_id,entry_id,prompt,answer,answered_at")
    .order("answered_at", { ascending: false });
  if (error) return readLocalJournal();
  return (data ?? []).map((row) => ({
    responseId: String(row.response_id),
    id: String(row.entry_id),
    prompt: String(row.prompt),
    text: String(row.answer),
    at: String(row.answered_at),
  }));
}

/** 답 한 건을 가리키는 ID.
 *
 *  crypto.randomUUID는 https와 localhost에서만 있다. 폰으로 개발 서버를
 *  http://192.168.x.x:3000처럼 열면 없어서 기록 저장이 통째로 실패한다.
 *  getRandomValues는 Crypto에서 유일하게 비보안 컨텍스트에서도 쓸 수 있으므로
 *  그때는 이쪽으로 만든다. UUID 모양을 흉내 내지는 않는다 — 이 값은 어디서도
 *  UUID로 파싱되지 않고, 형식을 맞추려면 버전·변형 비트를 손대야 해서 오히려 깨지기 쉽다. */
function newResponseId(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function saveJournalEntry(
  id: string,
  prompt: string,
  text: string,
): Promise<JournalEntry> {
  const saved: JournalEntry = {
    responseId: newResponseId(),
    id,
    prompt,
    text,
    at: new Date().toISOString(),
  };
  const remote = await remoteContext();
  if (!remote) {
    saveLocalJournal(saved);
    return saved;
  }
  const { error } = await remote.supabase.from("journal_entries").insert({
    user_id: remote.userId,
    response_id: saved.responseId,
    entry_id: id,
    prompt,
    answer: text,
    answered_at: saved.at,
  });
  if (error) {
    remoteWriteFailed("Wisor journal save failed", error);
    saveLocalJournal(saved);
  } else emitStoreChange();
  return saved;
}

function saveLocalJournal(saved: JournalEntry): void {
  if (!write(KEYS.journal, journalEntriesNewestFirst([saved, ...readLocalJournal()]))) {
    throw new Error("기록을 브라우저에 저장하지 못했습니다.");
  }
}

/** 답 한 건의 본문만 고친다. 답한 시각은 그대로 둔다 — 시각을 지금으로 옮기면
 *  "언제 이렇게 생각했나"가 사라져서, 답을 쌓아 둔 이유가 없어진다. */
export async function updateJournalEntry(responseId: string, text: string): Promise<void> {
  const remote = await remoteContext();
  if (!remote) {
    updateLocalJournal(responseId, text);
    return;
  }
  const { error } = await remote.supabase
    .from("journal_entries")
    .update({ answer: text })
    .eq("user_id", remote.userId)
    .eq("response_id", responseId);
  if (error) remoteWriteFailed("Wisor journal update failed", error);
  else emitStoreChange();
}

export async function deleteJournalEntry(responseId: string): Promise<void> {
  const remote = await remoteContext();
  if (!remote) {
    deleteLocalJournal(responseId);
    return;
  }
  const { error } = await remote.supabase
    .from("journal_entries")
    .delete()
    .eq("user_id", remote.userId)
    .eq("response_id", responseId);
  if (error) remoteWriteFailed("Wisor journal delete failed", error);
  else emitStoreChange();
}

function updateLocalJournal(responseId: string, text: string): void {
  const next = readLocalJournal().map((entry) =>
    entry.responseId === responseId ? { ...entry, text } : entry,
  );
  if (!write(KEYS.journal, next)) {
    throw new Error("기록을 브라우저에 저장하지 못했습니다.");
  }
}

function deleteLocalJournal(responseId: string): void {
  const next = readLocalJournal().filter((entry) => entry.responseId !== responseId);
  if (!write(KEYS.journal, next)) {
    throw new Error("기록을 브라우저에서 지우지 못했습니다.");
  }
}
