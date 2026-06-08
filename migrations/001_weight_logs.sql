-- Migration 001: weight_logs table
-- Run once in Supabase SQL editor:
-- https://supabase.com/dashboard/project/tqntkcvbyowaelchaqku/sql/new

create table if not exists public.weight_logs (
  id         uuid        primary key default gen_random_uuid(),
  user_id    text        not null,
  weight_lbs numeric(5,1) not null,
  log_date   date        not null,
  logged_at  timestamptz not null default now()
);

create unique index if not exists weight_logs_user_date
  on public.weight_logs (user_id, log_date);
