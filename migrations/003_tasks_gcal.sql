-- Migration 003: add gcal_event_id to tasks
-- Run once in Supabase SQL editor:
-- https://supabase.com/dashboard/project/tqntkcvbyowaelchaqku/sql/new

alter table public.tasks
  add column if not exists gcal_event_id text;
