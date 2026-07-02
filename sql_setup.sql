-- 1. เปิด Anonymous Auth ก่อน
-- Supabase Dashboard → Authentication → Providers → Anonymous → Enable
-- https://supabase.com/dashboard/project/tiehlmvwjvdlaoldtofu/auth/providers

-- 2. รัน SQL นี้ใน SQL Editor
-- https://supabase.com/dashboard/project/tiehlmvwjvdlaoldtofu/sql/new

-- quotes table
create table if not exists quotes (
  id text primary key,
  user_id uuid not null references auth.users(id),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table quotes enable row level security;

drop policy if exists "own quotes" on quotes;
create policy "own quotes" on quotes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- price_db table
create table if not exists price_db (
  user_id uuid primary key references auth.users(id),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table price_db enable row level security;

drop policy if exists "own price_db" on price_db;
create policy "own price_db" on price_db
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
