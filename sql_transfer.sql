-- 1. ตารางเก็บ transfer code (อายุ 15 นาที)
create table if not exists transfer_codes (
  id bigint generated always as identity primary key,
  code text not null unique,
  source_user_id uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS: insert ได้ทุกคน (auth), select เฉพาะแถวที่ code ตรง
alter table transfer_codes enable row level security;

drop policy if exists "insert transfer_codes" on transfer_codes;
create policy "insert transfer_codes" on transfer_codes
  for insert to authenticated with check (true);

-- RPC functions (security definer) bypass RLS — policy นี้สำหรับ direct query เท่านั้น
drop policy if exists "select transfer_codes" on transfer_codes;
create policy "select transfer_codes" on transfer_codes
  for select to authenticated using (source_user_id = auth.uid());

drop policy if exists "update own transfer_codes" on transfer_codes;
create policy "update own transfer_codes" on transfer_codes
  for update to authenticated using (source_user_id = auth.uid());

-- 2. RPC: ย้ายข้อมูลจาก source_user → dest_user
create or replace function transfer_data(p_code text, p_dest_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_user_id uuid;
  v_code_id bigint;
begin
  -- ตรวจสอบ code
  select id, source_user_id into v_code_id, v_source_user_id
  from transfer_codes
  where code = p_code and used = false and expires_at > now();

  if v_code_id is null then
    raise exception 'TRANSFER_CODE_INVALID';
  end if;

  -- Mark code as used
  update transfer_codes set used = true where id = v_code_id;

  -- Copy quotes
  insert into quotes (id, user_id, data, updated_at, deleted_at)
  select id, p_dest_user_id, data, updated_at, deleted_at
  from quotes
  where user_id = v_source_user_id
  on conflict (id) do nothing;

  -- Copy price_db (ถ้ามี)
  if exists (select 1 from price_db where user_id = v_source_user_id) then
    insert into price_db (user_id, data, updated_at)
    values (p_dest_user_id,
      (select data from price_db where user_id = v_source_user_id),
      now())
    on conflict (user_id) do update
      set data = excluded.data, updated_at = excluded.updated_at;
  end if;

  return true;
end;
$$;

-- 3. RPC: สร้าง transfer code
create or replace function generate_transfer_code(p_source_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_exists boolean;
begin
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    select exists(select 1 from transfer_codes where code = v_code and used = false and expires_at > now()) into v_exists;
    exit when not v_exists;
  end loop;

  insert into transfer_codes (code, source_user_id) values (v_code, p_source_user_id);
  return v_code;
end;
$$;
