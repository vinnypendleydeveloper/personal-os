-- Migration 004: task intelligence + time blocks + learning history
-- Run once in Supabase SQL editor (signed in as vincentpendleydev@gmail.com):
-- https://supabase.com/dashboard/project/tqntkcvbyowaelchaqku/sql/new

-- ── Tasks: time blocks + AI enrichment ──────────────────────────────────────
alter table public.tasks
  add column if not exists start_time   timestamptz,            -- optional time block start
  add column if not exists duration_min int,                     -- optional block length
  add column if not exists recurring    boolean default false,   -- daily/recurring vs one-time
  add column if not exists ai_enriched  boolean default false,   -- AI has categorized this
  add column if not exists ai_meta      jsonb   default '{}';     -- {category, priority, recurring, confidence, reasoning, user_overrode}

-- Sort timed tasks within a column efficiently
create index if not exists tasks_user_start_time
  on public.tasks (user_id, start_time);

-- ── Learning: how tasks have been categorized over time ─────────────────────
-- Recent rows are fed back to the AI as context so it learns Vinny's patterns
-- (e.g. "networking tasks default to normal priority unless a deadline").
create table if not exists public.task_categorizations (
  id                uuid        primary key default gen_random_uuid(),
  user_id           text        not null,
  task_id           uuid,
  raw_title         text        not null,
  inferred_tags     text[]      default '{}',
  inferred_priority text,                       -- urgent | high | normal | low
  recurring         boolean     default false,
  enriched_title    text,
  confidence        numeric,                     -- 0..1
  user_overrode     boolean     default false,   -- true once Vinny edits the AI's choices
  created_at        timestamptz not null default now()
);

create index if not exists task_categorizations_user_time
  on public.task_categorizations (user_id, created_at desc);

-- ── Learning: past morning debriefs + intake answers ────────────────────────
-- Referenced in future debriefs for continuity ("yesterday your afternoon
-- energy was low — front-load deep work again?").
create table if not exists public.debrief_history (
  id         uuid        primary key default gen_random_uuid(),
  user_id    text        not null,
  kind       text        not null,              -- routine | dashboard
  log_date   date        not null,
  intake     jsonb       default '{}',          -- the answers Vinny gave
  output     text,                              -- the generated plan/debrief
  created_at timestamptz not null default now()
);

create index if not exists debrief_history_user_time
  on public.debrief_history (user_id, created_at desc);

-- RLS (service role bypasses; deny all to anon/auth — matches existing tables)
alter table public.task_categorizations enable row level security;
alter table public.debrief_history       enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'task_categorizations' and policyname = 'deny all') then
    create policy "deny all" on public.task_categorizations for all using (false);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'debrief_history' and policyname = 'deny all') then
    create policy "deny all" on public.debrief_history for all using (false);
  end if;
end $$;
