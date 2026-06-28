-- Migration 007: add completion columns to new_features
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/tqntkcvbyowaelchaqku/sql/new

alter table public.new_features
  add column if not exists completed_at     timestamptz,
  add column if not exists completion_summary text;
