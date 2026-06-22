-- 하루보카 진도 저장 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 [Run] 한 번 실행하면 됩니다.

-- 진도 저장 테이블 (사용자당 1행)
create table if not exists public.progress (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

-- 행 수준 보안(RLS): 로그인한 본인 행만 읽고 쓸 수 있게 잠근다
alter table public.progress enable row level security;

create policy "본인 진도 조회" on public.progress
  for select using (auth.uid() = user_id);

create policy "본인 진도 입력" on public.progress
  for insert with check (auth.uid() = user_id);

create policy "본인 진도 수정" on public.progress
  for update using (auth.uid() = user_id);
