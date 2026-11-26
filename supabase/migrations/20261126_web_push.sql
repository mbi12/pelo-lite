-- Push endpoints and device capabilities are server-only secrets.
create table if not exists public.itutor_push_subscriptions (
  endpoint_hash text primary key,
  user_id text not null,
  subscription jsonb not null,
  token_hash text not null,
  sound boolean not null default true,
  origin text not null,
  updated_at timestamptz not null default now()
);
create index if not exists itutor_push_subscriptions_origin on public.itutor_push_subscriptions(origin);
alter table public.itutor_push_subscriptions enable row level security;
revoke all on public.itutor_push_subscriptions from anon, authenticated;
grant all on public.itutor_push_subscriptions to service_role;

-- Atomic claims prevent retrying the same offline send from duplicating alerts.
create table if not exists public.itutor_push_deliveries (
  message_id text not null,
  endpoint_hash text not null references public.itutor_push_subscriptions(endpoint_hash) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, endpoint_hash)
);
alter table public.itutor_push_deliveries enable row level security;
revoke all on public.itutor_push_deliveries from anon, authenticated;
grant all on public.itutor_push_deliveries to service_role;
