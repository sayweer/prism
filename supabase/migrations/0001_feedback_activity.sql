-- PRISM usage-proof backbone: in-app feedback + per-user on-chain activity log.
-- Security model: the browser ships the publishable (anon) key, so RLS is the boundary —
-- both tables are anon INSERT-only. No SELECT/UPDATE/DELETE policies exist for anon:
-- nobody can read other users' wallets/amounts with the bundled key.
-- (Mirrors the live schema on the 'prism' Supabase project; committed so the security
-- posture is reviewable from the repo, not just the dashboard.)

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  rating smallint not null,
  valuable_feature text not null,
  improvement_text text not null,
  would_use_production text not null,
  handle text,
  wallet_address text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity (
  id bigint generated always as identity primary key,
  wallet_address text not null,
  treasury_id text,
  action text not null, -- deploy | fund | whitelist | pay | reject
  tx_hash text,
  amount_xlm numeric,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
alter table public.activity enable row level security;

create policy "anon can insert feedback"
  on public.feedback for insert to anon with check (true);

create policy "anon can insert activity"
  on public.activity for insert to anon with check (true);
