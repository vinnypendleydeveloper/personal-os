-- Migration 006: bulletin board columns for new_features
-- Run in Supabase SQL editor:
-- https://supabase.com/dashboard/project/tqntkcvbyowaelchaqku/sql/new

ALTER TABLE public.new_features
  ADD COLUMN IF NOT EXISTS sort_order  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_expanded boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS category    text,
  ADD COLUMN IF NOT EXISTS effort      text;

-- Initialize sort_order to preserve existing ordering (when_to_add, created_at)
WITH ordered AS (
  SELECT id,
    (ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY when_to_add NULLS LAST, created_at
    ) - 1) AS rn
  FROM public.new_features
)
UPDATE public.new_features f
SET sort_order = o.rn
FROM ordered o
WHERE f.id = o.id;

DROP INDEX IF EXISTS new_features_user_date;

CREATE INDEX IF NOT EXISTS new_features_user_order
  ON public.new_features (user_id, sort_order, created_at);
