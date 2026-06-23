-- Migration 005: new_features table
-- Run once in Supabase SQL editor:
-- https://supabase.com/dashboard/project/tqntkcvbyowaelchaqku/sql/new

create table if not exists public.new_features (
  id            uuid        primary key default gen_random_uuid(),
  user_id       text        not null,
  title         text        not null,
  notes         text,
  when_to_add   date,
  created_at    timestamptz not null default now()
);

create index if not exists new_features_user_date
  on public.new_features (user_id, when_to_add nulls last, created_at);
