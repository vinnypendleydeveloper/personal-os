-- Vector similarity search function
-- Run this in Supabase SQL Editor after 0001_init.sql

create or replace function match_memory_chunks(
  query_embedding vector(1536),
  match_user_id text,
  match_count int default 20
)
returns table (
  id uuid,
  source_type text,
  source_id uuid,
  text text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    mc.id,
    mc.source_type,
    mc.source_id,
    mc.text,
    mc.created_at,
    1 - (mc.embedding <=> query_embedding) as similarity
  from memory_chunks mc
  where mc.user_id = match_user_id
  order by mc.embedding <=> query_embedding
  limit match_count;
$$;
