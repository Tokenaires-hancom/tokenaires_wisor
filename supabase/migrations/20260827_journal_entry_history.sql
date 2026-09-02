-- 기록형 답을 문항별 최신값이 아니라 응답별 이력으로 보존한다.

alter table public.journal_entries
  add column if not exists response_id text;

update public.journal_entries
set response_id =
  'legacy:' || entry_id || ':' ||
  pg_catalog.to_char(
    answered_at at time zone 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  )
where response_id is null;

alter table public.journal_entries
  alter column response_id set default uuid_generate_v4()::text,
  alter column response_id set not null;

alter table public.journal_entries
  drop constraint if exists journal_entries_pkey;

alter table public.journal_entries
  add constraint journal_entries_pkey primary key (user_id, response_id);

-- 정책과 권한은 손대지 않는다. 20260820이 만든 journal_entries_owner_only가
-- auth.uid() = user_id로 행을 가리므로 기본 키가 바뀌어도 그대로 맞고,
-- 사용자는 자기 답을 고치고 지울 수 있어야 한다 — 이력으로 쌓이는 것과
-- 잘못 쓴 답을 못 지우는 것은 별개다.

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

  -- 구버전 로컬 기록에는 responseId가 없으므로 브라우저와 같은 안정적 ID를 만든다.
  insert into public.journal_entries (
    user_id,
    response_id,
    entry_id,
    prompt,
    answer,
    answered_at
  )
  select
    auth.uid(),
    coalesce(
      nullif(entry ->> 'responseId', ''),
      'legacy:' || (entry ->> 'id') || ':' ||
      pg_catalog.to_char(
        (entry ->> 'at')::timestamptz at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      )
    ),
    entry ->> 'id',
    entry ->> 'prompt',
    entry ->> 'text',
    (entry ->> 'at')::timestamptz
  from jsonb_array_elements(coalesce(p_journal, '[]'::jsonb)) as entries(entry)
  where coalesce(entry ->> 'id', '') <> ''
  on conflict (user_id, response_id) do nothing;
end;
$$;

revoke all on function public.import_learning_state(text[], jsonb, jsonb, jsonb) from public;
grant execute on function public.import_learning_state(text[], jsonb, jsonb, jsonb) to authenticated;
