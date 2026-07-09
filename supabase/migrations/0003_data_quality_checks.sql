-- PRISM data-quality guardrails for the anon INSERT-only tables. 0001 created `feedback`
-- and `activity` with NO value/length constraints, so the bundled publishable key can push
-- arbitrary or oversized rows (analytics poisoning + storage abuse). This mirrors the
-- server-side clamps in web/src/lib/activity.ts (64/64/80) and funnel_events' posture (0002)
-- so the DB — not just the client — is the boundary.
--
-- All constraints are added NOT VALID: they enforce every NEW insert immediately, but do
-- NOT re-scan existing rows. `feedback` is no longer written by the app (it moved to a
-- Google Form, see FeedbackButton.tsx) and its historical rows predate any rating scale,
-- so validating them could fail; `activity` may hold rows with actions/lengths from before
-- this allowlist existed. Validate later, after confirming the data (see bottom).

-- activity: action must be one of the known verbs; ids/hashes bounded to the client clamps.
alter table public.activity
  add constraint activity_action_allowed check (action in (
    'deploy', 'fund', 'whitelist', 'pay', 'reject', 'pause', 'withdraw', 'limits',
    'session_start', 'session_revoke', 'agent_pay', 'register'
  )) not valid;
alter table public.activity
  add constraint activity_wallet_len check (char_length(wallet_address) <= 64) not valid;
alter table public.activity
  add constraint activity_treasury_len check (treasury_id is null or char_length(treasury_id) <= 64) not valid;
alter table public.activity
  add constraint activity_txhash_len check (tx_hash is null or char_length(tx_hash) <= 80) not valid;

-- feedback: bounded rating + text lengths (kept generous; app no longer writes here).
alter table public.feedback
  add constraint feedback_rating_range check (rating between 1 and 5) not valid;
alter table public.feedback
  add constraint feedback_valuable_len check (char_length(valuable_feature) <= 200) not valid;
alter table public.feedback
  add constraint feedback_improvement_len check (char_length(improvement_text) <= 2000) not valid;

-- To validate existing rows later (run each after confirming the data holds), e.g.:
--   select min(rating), max(rating) from public.feedback;              -- expect 1..5
--   select action, count(*) from public.activity group by action;     -- expect known verbs
-- then, once clean:
--   alter table public.activity validate constraint activity_action_allowed;
--   alter table public.activity validate constraint activity_wallet_len;
--   alter table public.activity validate constraint activity_treasury_len;
--   alter table public.activity validate constraint activity_txhash_len;
--   alter table public.feedback validate constraint feedback_rating_range;
--   alter table public.feedback validate constraint feedback_valuable_len;
--   alter table public.feedback validate constraint feedback_improvement_len;
