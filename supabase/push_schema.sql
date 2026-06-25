-- 하루보카 Web Push 알림 구독 테이블
-- Supabase Dashboard > SQL Editor 에서 실행

create table if not exists push_subscriptions (
  endpoint       text        primary key,          -- 브라우저 push endpoint (고유 식별자)
  user_id        uuid        references auth.users(id) on delete set null,
  subscription   jsonb       not null,              -- PushSubscription.toJSON() 전체
  notify_hour    smallint    not null default 8     -- KST 기준 알림 시각 (0~23)
                             check (notify_hour between 0 and 23),
  enabled        boolean     not null default true,
  updated_at     timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

-- 누구나 자신의 구독을 등록/갱신할 수 있음 (endpoint가 비밀키 역할)
create policy "push_sub_insert" on push_subscriptions
  for insert with check (true);

create policy "push_sub_update" on push_subscriptions
  for update using (true);

create policy "push_sub_delete" on push_subscriptions
  for delete using (true);

-- SELECT는 service role(Edge Function)만 가능 (anon 정책 없음)
