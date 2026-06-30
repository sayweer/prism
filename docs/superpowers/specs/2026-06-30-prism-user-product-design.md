# Prism — User-Facing Product (risein Level 4)

**Date:** 2026-06-30
**Status:** Approved design, ready for implementation plan
**Goal:** Turn Prism from a single-tenant **showcase demo** into a **user-facing product** where any visitor connects a wallet and operates their *own* bounded treasury — satisfying risein **Level 4 (Green Belt)**: Production-Ready MVP + Real Users + Product Validation.

---

## 1. Context

Today the app is a guided demo: one hardcoded treasury (`TREASURY_ID`), one embedded `AGENT_SECRET`, scripted `TASKS`. It proves the concept but no one can *use* it. Level 4 requires a real MVP with 10 real users, wallet-interaction proof, feedback collection, and analytics.

The contract is **already per-user ready** — `treasury/src/lib.rs` `__constructor(admin, agent, token, daily_limit, per_task_limit)` is fully parametric, `add_payee`/policy are `admin.require_auth`, `pay` is `agent.require_auth`, and the WASM (`41c8bb1f…`) is installed on-chain. The missing piece is a thin **frontend orchestration layer** that lets each user deploy/fund/govern/spend their own treasury, signed by their wallet.

Network: **Stellar testnet** (Level 4 requires testnet; mainnet is Level 5-7). Ambassadors already run testnet Freighter, so onboarding (the 10 real users) is frictionless via the WhatsApp ambassador group.

## 2. Goals / Non-Goals

**Goals (this version):**
- Wallet = identity. Connect → personal workspace ("your Prism").
- Per-user treasury: deploy, fund, set policy, spend — all wallet-signed.
- Analytics & monitoring (spend trend, violations, agent scorecard, error tracking).
- Feedback collection, re-enabled (fix the prior submit failure).
- Keep the existing showcase demo for unconnected visitors.

**Non-Goals (later waves, explicitly out of scope):**
- Mainnet / real USDC / audit (Level 5-7).
- On-chain treasury registry (start with localStorage + manual address entry).
- Connecting an external AI agent via MCP/SDK (wave A).
- Real ZK prover for per-user batches (wave C).
- 8004 reputation passport (wave B — include only if time remains; not required for Level 4).

## 3. User Flow

```
Visitor (no wallet)  → landing + showcase demo (unchanged; first impression + hackathon submission)
Connect wallet (testnet) → profile = wallet address
  ├─ No treasury yet → "Create treasury": enter daily limit + per-task limit → sign → deploy
  │     (admin = agent = wallet · token = native XLM SAC)
  ├─ Fund → send testnet XLM from wallet into the treasury (SAC transfer, wallet-signed)
  ├─ Policy → add/remove a whitelisted payee (wallet-signed, admin auth)
  ├─ Spend → payee + amount → wallet-signed pay(); contract enforces policy, rejects violations on-chain
  └─ Workspace panel → balance · daily spent vs limit · payment history · violations · analytics
Feedback button → available app-wide
Disconnect → back to visitor view
```

## 4. Architecture & Components

Reuse and adapt existing files; do not rewrite.

- **`web/src/lib/walletKit.ts`** (new): single StellarWalletsKit instance + a `walletSigner` adapter that satisfies the `@stellar/stellar-sdk/contract` `signTransaction` shape (wraps `StellarWalletsKit.signTransaction`). Extracted from `Wallet.tsx` so both the wallet view and contract calls share one kit. Holds the connected address (context/store).
- **`web/src/lib/userTreasury.ts`** (new): per-user treasury operations against a *runtime* contract id (not the hardcoded one): `deployTreasury(admin, daily, perTask)`, `fundTreasury(amount)` (XLM SAC transfer to the treasury contract), `addPayee/removePayee`, `pay`, `readState`, `history`. Mirrors `prism.ts` but parametric on contract id + wallet signer instead of the embedded agent.
- **`web/src/lib/treasuryStore.ts`** (new): map wallet address → treasury contract id, persisted in `localStorage`; plus a "use an existing treasury address" entry path.
- **`web/src/components/Workspace.tsx`** (new): the connected-user view — create/fund/policy/spend + state panel. Composes existing pieces.
- **`web/src/components/Analytics.tsx`** (new): spend trend, violation count, agent scorecard, derived from contract events (`paid`) + tracked client errors.
- **Adapt `Wallet.tsx`**: consume the shared `walletKit.ts` instead of its own kit instance.
- **Adapt `Dashboard.tsx`**: stays as the unconnected showcase demo (read-only). Connected users land in `Workspace`.
- **Re-enable feedback**: `FeedbackModal` / `FeedbackButton` / `lib/feedback.ts` / `lib/supabase.ts` already exist; fix the "Could not send" submit failure and wire the connected wallet address into the feedback payload.

## 5. Data & State

- **Connected address** — from the wallet kit (session).
- **Treasury id** — `localStorage["prism_treasury:<address>"]`; resolved on connect. If absent → "create" path; user may also paste an existing treasury address.
- **Treasury state** — read live via simulation: `balance()`, `get_config()` (admin/agent/token/daily/per-task), `day_spent()`, payment history via `paid` events (RPC `getEvents`, already implemented in `lib/events.ts`).
- **Token** — native XLM SAC on testnet (`CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`).
- **Feedback** — Supabase `feedback` table (already provisioned, project `gspgddphkommgjuipfzz`).

## 6. Key Technical Decisions

1. **agent = admin = connected wallet** (the "(b)" path): the user signs their own `pay`. No custody, no embedded key. A separate AI-agent key is an opt-in later wave. Keeps the contract's admin/agent split intact for future use.
2. **Native XLM**, not USDC: testnet USDC is alice-minted and can't be obtained by arbitrary users; XLM is free from friendbot → zero onboarding friction.
3. **localStorage lookup**, not an on-chain registry: fastest path to a working MVP; manual address entry covers cross-device. Registry is a later wave.
4. **Deploy from the browser**: `Client.deploy(...)` with the installed WASM hash + a salt + the wallet signer. The user's wallet signs the deploy tx.
5. **Wallet signing for contract calls**: a `walletSigner` adapter bridges `StellarWalletsKit.signTransaction` to the contract client's expected signer — the single highest-risk integration point; validate first with the deploy call.
6. **Demo preserved**: unconnected `Dashboard` stays the spectator showcase. This is also the hackathon submission's first impression — we don't remove it.

## 7. Error Handling

- Reuse the typed wallet errors (`lib/wallet-errors.ts`) — not installed / rejected / insufficient balance.
- Contract guardrail rejections (`#1..#8`) surfaced verbatim (e.g. `PayeeNotWhitelisted`, `ExceedsDailyLimit`) — these are the *product working*, shown as informative, not as failures.
- Deploy/fund/transient RPC errors: retry-with-backoff pattern already in `prism.ts` (`isTransient`), reused.
- Every per-user view has explicit loading + empty + error states (Level 4 requirement).
- Client-side errors tracked (count + last message) and surfaced in Analytics → satisfies "error tracking and monitoring".

## 8. Testing

- Unit (Vitest, existing harness): `treasuryStore` (address↔treasury mapping), `walletSigner` shape, analytics reducers over sample events, feedback payload builder. Pure functions, TDD.
- Manual live testnet E2E before deploy: connect → create → fund → add payee → pay (in-policy success + over-limit rejection) → history/analytics update → feedback submit. Verified against the live app, not mocks ([[feedback_verify_live_not_mock]]).
- Existing contract tests (`cargo test -p treasury`, 14/14) unchanged — contract isn't modified.

## 9. Level 4 Checklist Mapping

| Level 4 requirement | Covered by |
|---|---|
| Production MVP, stable architecture, mobile, loading/error states | Workspace + adapted components, explicit states |
| 10 real users + wallet-interaction proof | per-user flow → distributed via WhatsApp ambassador group; on-chain txs are the proof |
| Feedback collection (mandatory) + summary | re-enabled feedback + README summary |
| Production deploy | `vercel --prod` → `prism-stellar.vercel.app` |
| Monitoring + analytics | `Analytics.tsx` + client error tracking |
| 15+ commits · public repo · README · contract address · demo video · live link | already satisfied; README updated with Level 4 narrative |

## 10. Build Order

1. `walletKit.ts` + `walletSigner` adapter; adapt `Wallet.tsx` (validate signer with a real signed tx).
2. `userTreasury.ts` + `treasuryStore.ts` — deploy/fund/policy/pay/read against a runtime contract id.
3. `Workspace.tsx` — wire the full create→fund→policy→spend→panel flow.
4. Re-enable feedback (fix submit failure, attach wallet address).
5. `Analytics.tsx` — events + error tracking.
6. Deploy + manual live E2E.
7. (If time) wave B — 8004 reputation passport.
8. README Level 4 narrative; user distribution; collect proof → submit.
