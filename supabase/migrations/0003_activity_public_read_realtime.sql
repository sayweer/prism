-- Activity mirrors public on-chain actions (addresses + tx hashes are already public
-- on Stellar), so read access is safe; feedback stays INSERT-only. Applied 2026-07-12.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'activity' and policyname = 'activity_public_read'
  ) then
    create policy activity_public_read on public.activity
      for select to anon, authenticated using (true);
  end if;
end $$;

-- Live INSERT stream for the Activity feed (Supabase Realtime).
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity'
  ) then
    alter publication supabase_realtime add table public.activity;
  end if;
end $$;
