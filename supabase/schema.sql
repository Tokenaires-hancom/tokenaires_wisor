-- Wisor 사용자 데이터 스키마 (2번: 백엔드·플랫폼 담당 영역)
--
-- 저장하는 것: 학습 진도, 퀴즈 결과, 관심종목, 학습노트, 기록형 답
-- 저장하지 않는 것: 계좌 화면, 보유 수량, 평가금액, 증권사 정보
--
-- 실행:  supabase db push   또는   psql -f supabase/schema.sql

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------- 학습 진도

create table if not exists public.lesson_progress (
  user_id      uuid not null references auth.users on delete cascade,
  lesson_id    text not null,                       -- 예: 'master:buffett:1'
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.quiz_results (
  user_id    uuid not null references auth.users on delete cascade,
  lesson_id  text not null,
  correct    smallint not null check (correct >= 0),
  total      smallint not null check (total > 0),
  taken_at   timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- ---------------------------------------------------------------- 관심종목

create table if not exists public.watchlist (
  user_id  uuid not null references auth.users on delete cascade,
  ticker   text not null,
  added_at timestamptz not null default now(),
  primary key (user_id, ticker)
);

-- ---------------------------------------------------------------- 학습노트

create type public.note_status as enum (
  'first',     -- 처음 확인
  'digging',   -- 추가 조사 필요
  'learned',   -- 학습 완료
  'watching',  -- 관찰 중
  'dropped'    -- 관심 제외
);
-- 매수 예정·매도 예정 같은 상태는 두지 않는다. 학습 중심 상태만 쓴다.

create table if not exists public.study_notes (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references auth.users on delete cascade,
  ticker             text not null,
  company_name       text not null,
  why_interested     text default '',
  -- 노트를 만든 시점의 점수를 그대로 굳혀 둔다. 나중에 점수가 바뀌어도
  -- 그때 무엇을 보고 판단했는지가 남아야 복기가 된다.
  style_scores       jsonb not null default '[]'::jsonb,
  strengths          text[] not null default '{}',
  risks              text[] not null default '{}',
  open_questions     text default '',
  status             public.note_status not null default 'first',
  score_model        text,                 -- 예: 'Buffett 1.0'
  data_as_of         date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, ticker)
);

create index if not exists study_notes_user_updated_idx
  on public.study_notes (user_id, updated_at desc);

-- ------------------------------------------------------------- 기록형 답과 복습

create table if not exists public.journal_entries (
  user_id    uuid not null references auth.users on delete cascade,
  entry_id   text not null,
  prompt     text not null,
  answer     text not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create index if not exists journal_entries_user_answered_idx
  on public.journal_entries (user_id, answered_at desc);

-- ---------------------------------------------------------------- 접근 권한

alter table public.lesson_progress        enable row level security;
alter table public.quiz_results           enable row level security;
alter table public.watchlist              enable row level security;
alter table public.study_notes            enable row level security;
alter table public.journal_entries         enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'lesson_progress', 'quiz_results', 'watchlist', 'study_notes', 'journal_entries'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all
         using (auth.uid() = user_id)
         with check (auth.uid() = user_id)',
      t || '_owner_only', t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------- 갱신 시각

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create trigger study_notes_touch
  before update on public.study_notes
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------- 비회원 기록 계정 이전

-- 한 트랜잭션 안에서 브라우저 임시 기록을 기존 계정 기록과 병합한다.
-- 집합 데이터는 합치고, 같은 퀴즈·노트·기록형 답은 더 최근 항목을 남긴다.
create or replace function public.import_learning_state(
  p_watchlist text[],
  p_notes jsonb,
  p_progress jsonb,
  p_journal jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.watchlist (user_id, ticker)
  select auth.uid(), ticker
  from unnest(coalesce(p_watchlist, array[]::text[])) as tickers(ticker)
  where ticker <> ''
  on conflict (user_id, ticker) do nothing;

  insert into public.lesson_progress (user_id, lesson_id)
  select auth.uid(), lesson_id
  from jsonb_array_elements_text(coalesce(p_progress -> 'lessonsDone', '[]'::jsonb)) as lessons(lesson_id)
  where lesson_id <> ''
  on conflict (user_id, lesson_id) do nothing;

  insert into public.quiz_results (user_id, lesson_id, correct, total, taken_at)
  select
    auth.uid(),
    item.key,
    (item.value ->> 'correct')::smallint,
    (item.value ->> 'total')::smallint,
    (item.value ->> 'at')::timestamptz
  from jsonb_each(coalesce(p_progress -> 'quizResults', '{}'::jsonb)) as item
  where (item.value ->> 'total')::integer > 0
  on conflict (user_id, lesson_id) do update
    set correct = excluded.correct,
        total = excluded.total,
        taken_at = excluded.taken_at
    where excluded.taken_at >= public.quiz_results.taken_at;

  insert into public.study_notes (
    user_id,
    ticker,
    company_name,
    why_interested,
    style_scores,
    strengths,
    risks,
    open_questions,
    status,
    updated_at
  )
  select
    auth.uid(),
    note ->> 'ticker',
    note ->> 'name',
    coalesce(note ->> 'whyInterested', ''),
    coalesce(note -> 'styleScores', '[]'::jsonb),
    array(select jsonb_array_elements_text(coalesce(note -> 'strengths', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(note -> 'risks', '[]'::jsonb))),
    coalesce(note ->> 'openQuestions', ''),
    (note ->> 'status')::public.note_status,
    (note ->> 'updatedAt')::timestamptz
  from jsonb_array_elements(coalesce(p_notes, '[]'::jsonb)) as note
  where coalesce(note ->> 'ticker', '') <> ''
  on conflict (user_id, ticker) do update
    set company_name = excluded.company_name,
        why_interested = excluded.why_interested,
        style_scores = excluded.style_scores,
        strengths = excluded.strengths,
        risks = excluded.risks,
        open_questions = excluded.open_questions,
        status = excluded.status,
        updated_at = excluded.updated_at
    where excluded.updated_at >= public.study_notes.updated_at;

  insert into public.journal_entries (user_id, entry_id, prompt, answer, answered_at)
  select
    auth.uid(),
    entry ->> 'id',
    entry ->> 'prompt',
    entry ->> 'text',
    (entry ->> 'at')::timestamptz
  from jsonb_array_elements(coalesce(p_journal, '[]'::jsonb)) as entry
  where coalesce(entry ->> 'id', '') <> ''
  on conflict (user_id, entry_id) do update
    set prompt = excluded.prompt,
        answer = excluded.answer,
        answered_at = excluded.answered_at
    where excluded.answered_at >= public.journal_entries.answered_at;
end;
$$;

grant select, insert, update, delete on public.lesson_progress to authenticated;
grant select, insert, update, delete on public.quiz_results to authenticated;
grant select, insert, update, delete on public.watchlist to authenticated;
grant select, insert, update, delete on public.study_notes to authenticated;
grant select, insert, update, delete on public.journal_entries to authenticated;

revoke all on function public.import_learning_state(text[], jsonb, jsonb, jsonb) from public;
grant execute on function public.import_learning_state(text[], jsonb, jsonb, jsonb) to authenticated;
