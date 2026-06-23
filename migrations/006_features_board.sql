-- Migration 006: create new_features table with bulletin board columns
-- Combines 005 (base table) + 006 (board columns) so either can be run standalone.
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/tqntkcvbyowaelchaqku/sql/new

-- Create table with all columns (no-op if already exists from 005)
create table if not exists public.new_features (
  id            uuid        primary key default gen_random_uuid(),
  user_id       text        not null,
  title         text        not null,
  notes         text,
  when_to_add   date,
  created_at    timestamptz not null default now(),
  sort_order    integer     not null default 0,
  is_expanded   boolean     not null default true,
  category      text,
  effort        text
);

-- If 005 was already run, add the new columns (IF NOT EXISTS is safe to re-run)
alter table public.new_features
  add column if not exists sort_order  integer not null default 0,
  add column if not exists is_expanded boolean not null default true,
  add column if not exists category    text,
  add column if not exists effort      text;

-- Initialize sort_order for any existing rows that are all at 0
with ordered as (
  select id,
    (row_number() over (
      partition by user_id
      order by when_to_add nulls last, created_at
    ) - 1) as rn
  from public.new_features
  where sort_order = 0
)
update public.new_features f
set sort_order = o.rn
from ordered o
where f.id = o.id;

-- Indexes
drop index if exists new_features_user_date;

create index if not exists new_features_user_order
  on public.new_features (user_id, sort_order, created_at);
