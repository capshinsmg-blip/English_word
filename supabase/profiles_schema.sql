-- 하루보카 닉네임 프로필 테이블
-- Supabase Dashboard > SQL Editor에서 실행

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nickname    text unique not null check (length(nickname) between 2 and 12),
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

-- 닉네임 중복 확인은 누구나 가능 (SELECT 공개)
create policy "profiles_select" on profiles for select using (true);
-- 본인 행만 추가/수정 가능
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);
