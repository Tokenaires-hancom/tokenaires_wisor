-- Wisor 사용자 데이터 스키마 (2번: 백엔드·플랫폼 담당 영역)
--
-- 저장하는 것: 학습 진도, 퀴즈 결과, 관심종목, 학습노트, 차트 분석 사용 횟수
-- 저장하지 않는 것: 차트 원본 이미지, 계좌 화면, 보유 수량, 평가금액, 증권사 정보
--
-- 실행:  supabase db push   또는   psql -f supabase/schema.sql

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------- 학습 진도

create table if not exists public.lesson_progress (
  user_id      uuid not null references auth.users on delete cascade,
  lesson_id    text not null,                       -- 'master:buffett' | 'chart:trend-basics'
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
  chart_observations text[] not null default '{}',
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

-- ------------------------------------------------- 차트 분석 사용 기록

-- 원본 이미지는 남기지 않는다. 사용량 제한과 품질 추적에 필요한 최소한만 남긴다.
create table if not exists public.chart_analysis_events (
  id             bigserial primary key,
  user_id        uuid not null references auth.users on delete cascade,
  requested_at   timestamptz not null default now(),
  succeeded      boolean not null,
  lesson_id      text,
  prompt_version text,
  filtered_count smallint not null default 0,   -- 안전 필터가 떼어낸 문장 수
  reject_reason  text                            -- 거절한 경우의 사유 코드
);

create index if not exists chart_events_user_day_idx
  on public.chart_analysis_events (user_id, requested_at desc);

-- 하루 사용 횟수 (베타 제한용)
create or replace function public.chart_analysis_count_today(p_user_id uuid)
returns integer
language sql
stable
as $$
  select count(*)::int
  from public.chart_analysis_events
  where user_id = p_user_id
    and requested_at >= date_trunc('day', now() at time zone 'Asia/Seoul');
$$;

-- ---------------------------------------------------------------- 접근 권한

alter table public.lesson_progress        enable row level security;
alter table public.quiz_results           enable row level security;
alter table public.watchlist              enable row level security;
alter table public.study_notes            enable row level security;
alter table public.chart_analysis_events  enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'lesson_progress', 'quiz_results', 'watchlist', 'study_notes', 'chart_analysis_events'
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
