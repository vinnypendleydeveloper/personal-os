-- Enable vector extension for memory/embeddings
create extension if not exists vector;

-- Entities (people, companies, projects you track in CRM)
create table entities (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  kind text not null, -- person | company | project | other
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Raw captures (everything that comes in via Telegram or web form)
create table raw_captures (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source text not null, -- telegram | web
  raw_text text,
  audio_url text,
  classification jsonb default '{}',
  llm_source text,
  routed_to text,
  routed_id uuid,
  created_at timestamptz default now()
);

-- Tasks / CRM items
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null,
  description text,
  urgency text not null default 'someday', -- today | this_week | this_month | someday
  key boolean default false,
  priority_score float default 0,
  time_estimate_min int,
  tags text[] default '{}',
  due_date date,
  owner text,
  entity_id uuid references entities(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Daily logs (habits, nutrition, goals, finance snapshots — all keyed by date)
create table daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  log_date date not null,
  notes jsonb default '{}', -- flexible: habits, nutrition, goals, finance
  mood int, -- 1–5
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, log_date)
);

-- Memory chunks for vector search
create table memory_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_type text not null, -- capture | task | journal | habit | meal
  source_id uuid,
  text text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Audit log
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Vector similarity index
create index on memory_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- RLS: deny all by default (service role bypasses RLS)
alter table entities enable row level security;
alter table raw_captures enable row level security;
alter table tasks enable row level security;
alter table daily_logs enable row level security;
alter table memory_chunks enable row level security;
alter table audit_log enable row level security;

create policy "deny all" on entities for all using (false);
create policy "deny all" on raw_captures for all using (false);
create policy "deny all" on tasks for all using (false);
create policy "deny all" on daily_logs for all using (false);
create policy "deny all" on memory_chunks for all using (false);
create policy "deny all" on audit_log for all using (false);
