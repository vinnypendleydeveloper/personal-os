-- Migration 002: brain_conversations
-- Persistent memory for the Brain page AI chat.
-- Run once in Supabase SQL editor (signed in as vincentpendleydev@gmail.com):
-- https://supabase.com/dashboard/project/tqntkcvbyowaelchaqku/sql/new

create table if not exists public.brain_conversations (
  id         uuid        primary key default gen_random_uuid(),
  user_id    text        not null,
  role       text        not null check (role in ('user', 'assistant')),
  content    text        not null,
  created_at timestamptz not null default now()
);

-- Fast "recent turns for this user, newest first" lookups
create index if not exists brain_conversations_user_time
  on public.brain_conversations (user_id, created_at desc);
