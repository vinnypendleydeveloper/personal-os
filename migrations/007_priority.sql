-- Migration 007: add priority column to new_features
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/tqntkcvbyowaelchaqku/sql/new

alter table public.new_features
  add column if not exists priority text;
