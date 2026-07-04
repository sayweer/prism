-- PRISM funnel visibility: the steps *before* an on-chain action. `activity` only records
-- deploy-and-after, so the wallet-connect wall — where WhatsApp / mobile visitors actually
-- drop off — was invisible. This table makes the drop-off measurable: which step, which
-- device, which wallet, and whether the connect succeeded, errored, or was dismissed.
-- Same security posture as 0001: anon INSERT-only (RLS is the boundary for the bundled key).

create table if not exists public.funnel_events (
  id bigint generated always as identity primary key,
  event text not null check (event in ('page_view', 'connect_click', 'connect_result')),
  device text check (device in ('mobile', 'desktop')),
  wallet_id text check (wallet_id is null or char_length(wallet_id) <= 40),
  outcome text check (outcome in ('success', 'error', 'dismissed')),
  detail text check (detail is null or char_length(detail) <= 200),
  session_id text check (session_id is null or char_length(session_id) <= 64),
  created_at timestamptz not null default now()
);

alter table public.funnel_events enable row level security;

create policy "anon can insert funnel_events"
  on public.funnel_events for insert to anon with check (true);
