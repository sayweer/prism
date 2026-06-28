# Prism — Feedback Collection (Design Spec)

**Date:** 2026-06-29
**Status:** Approved, ready for implementation plan
**Topic:** In-app feedback collection for Prism (Stellar)

## Goal

Add an in-app feedback mechanism to Prism so real users — primarily the Stellar Türkiye ambassador/dev community (WhatsApp group + Stellar Developers Discord, ~31k members, technical and wallet-owning) — can leave structured product feedback after trying the live demo at `prism-stellar.vercel.app`.

This serves two ends:
1. **Product direction** — capture "what should we improve / what to add" from real, technical users.
2. **risein Builder Track Level 4 (Green Belt)** — satisfies the mandatory *"Basic user feedback collection"* requirement, and (via the optional wallet field) ties feedback to the *"10+ real user wallet interactions"* requirement in a single record.

## Context

- Frontend: `prism/web` — Vite + React + TypeScript SPA, deployed to Vercel (`prism-stellar` project, `prism-stellar.vercel.app`).
- Existing design language: Stellar-yellow (`#FDDA24`) palette, dark editorial theme, fonts Fraunces (display) + Inter + JetBrains Mono.
- Wallet integration already present: StellarWalletsKit (multi-wallet) in `web/src/components/Wallet.tsx`; the connected wallet address is available in app state.
- No backend currently — the web app is a static SPA. Feedback needs durable storage.

## Architecture

**Backend: Supabase** (existing account, managed via Supabase MCP).
- A single table `feedback` in a Supabase project dedicated to / reused for Prism.
- The browser writes directly via `@supabase/supabase-js` using the project's **anon (publishable) key** — no Worker/server function needed.
- Security via **Row Level Security (RLS)**: anonymous role may `INSERT` only; no `SELECT`/`UPDATE`/`DELETE` for anon (nobody can read or tamper with others' feedback from the client). The owner reads rows from the Supabase dashboard.

**Frontend: two small, focused components in `prism/web`.**
- `FeedbackButton` — a fixed, bottom-right "Share feedback" button, visible across all views (Landing / Agent demo / Wallet / Activity). Matches the existing premium dark + Stellar-yellow aesthetic; anti-slop.
- `FeedbackModal` — the rich form (fields below), opened by the button. Handles submit, loading, success, and error states.
- A thin `lib/feedback.ts` (or `lib/supabase.ts`) wrapping the Supabase client + the `submitFeedback(payload)` call. Single purpose: own the Supabase interaction so components stay presentational.

## Data model

Table `feedback`:

| column | type | notes |
|--------|------|-------|
| `id` | `bigint generated always as identity` PK | |
| `rating` | `smallint` | 1–5, required |
| `valuable_feature` | `text` | one of: `bounded`, `confidential_zk`, `x402`, `escrow_reputation`; required |
| `improvement_text` | `text` | open text, "what to improve / add"; required |
| `would_use_production` | `text` | one of: `yes`, `maybe`, `no`; required |
| `handle` | `text` | optional — Discord/X handle |
| `wallet_address` | `text` | optional — Stellar address; auto-filled if a wallet is connected |
| `created_at` | `timestamptz default now()` | |

RLS policy: `enable row level security`; policy `allow anon insert` for role `anon` on `INSERT` with `check (true)`. No select/update/delete policy for `anon`.

Light validation enforced at insert (and mirrored client-side): `rating between 1 and 5`, `valuable_feature in (...)`, `would_use_production in (...)`, `improvement_text` non-empty and length-capped (e.g. ≤ 2000 chars).

## Form fields (rich)

1. **Overall rating** — 1–5 (segmented/star control). Required.
2. **Most valuable feature** — single choice: Bounded limits · Confidential ZK · x402 · Escrow/reputation. Required.
3. **What should we improve / add?** — open textarea. Required.
4. **Would you use this in production?** — Yes / Maybe / No. Required.
5. **Name / handle** — optional (Discord or X).
6. **Wallet** — optional; if a wallet is already connected in the app, auto-fill the address (user can clear it). This is the link between *feedback* and *wallet interaction*.

## Data flow + error handling

1. User clicks `FeedbackButton` → `FeedbackModal` opens.
2. User fills the form. Client-side validation blocks submit until required fields are valid (inline messages).
3. On submit → loading state → `submitFeedback()` inserts one row via supabase-js.
4. Success → success state ("Thanks — your feedback was recorded.") → modal can be closed; button shows a subtle "submitted" affordance for the session.
5. Failure (network / RLS / validation) → non-blocking error message + retry; the typed content is preserved (not cleared).

## Security

- Only the **anon/publishable** key ships to the client — safe to expose; RLS is the real boundary.
- Anon role is **insert-only**; no read access from the browser, so one user cannot enumerate or scrape others' feedback.
- Length caps + enum checks at the DB level guard against junk/abuse payloads. (Rate limiting / captcha is out of scope for v1; volume is small and audience is a trusted community — revisit only if spammed.)

## Configuration

- New env vars in `prism/web`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Vite build-time, `VITE_` prefix). Added to the `prism-stellar` Vercel project and to a local `.env` for dev.
- New dependency: `@supabase/supabase-js`.

## Reading feedback (owner)

- Primary: Supabase dashboard table view / SQL.
- For the Level 4 "feedback summary": a short SQL aggregation (avg rating, distribution of `valuable_feature`, count by `would_use_production`, list of `improvement_text`) — produced on demand, not a built UI.
- **No admin page** (YAGNI) — the Supabase dashboard already serves this.

## Out of scope (v1)

- Admin/feedback-viewer page inside Prism.
- Auth/login for feedback (anonymous insert is the point — low friction).
- Editing/deleting feedback from the client.
- Rate limiting / captcha (revisit only if abused).
- On-chain feedback (off-chain Supabase is sufficient).

## Testing

- Unit: `submitFeedback()` payload shaping + client-side validation (Vitest, alongside existing `web/src/lib/*.test.ts`).
- Manual: submit a feedback row against the live Supabase table from the deployed site; confirm the row appears, with and without a connected wallet; confirm anon cannot `SELECT` (read returns empty/denied).
- Build: `npm run build` clean; CI green.

## Success criteria

1. A visitor on `prism-stellar.vercel.app` can open the feedback form from any view and submit a complete rich-form response, stored in Supabase.
2. When a wallet is connected, its address is captured alongside the feedback.
3. Anonymous clients can insert but cannot read others' rows (RLS verified).
4. The owner can pull a feedback summary via SQL for the Level 4 submission.
5. Frontend matches Prism's existing premium aesthetic; build + CI green.
