-- 비회원 학습 기록을 계정으로 이전하기 위한 증분 마이그레이션.
-- 기존 supabase/schema.sql의 사용자 데이터 테이블이 먼저 적용돼 있어야 한다.

create table if not exists public.journal_entries (
  user_id     uuid not null references auth.users on delete cascade,
  entry_id    text not null,
  prompt      text not null,
  answer      text not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create index if not exists journal_entries_user_answered_idx
  on public.journal_entries (user_id, answered_at desc);

alter table public.journal_entries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'journal_entries'
      and policyname = 'journal_entries_owner_only'
  ) then
    create policy journal_entries_owner_only on public.journal_entries for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

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
  from jsonb_array_elements_text(
    coalesce(p_progress -> 'lessonsDone', '[]'::jsonb)
  ) as lessons(lesson_id)
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
