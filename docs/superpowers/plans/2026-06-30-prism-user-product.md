# Prism User-Facing Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any visitor connect a wallet and operate their own bounded treasury (deploy/fund/policy/spend, all wallet-signed) on Stellar testnet, plus analytics + re-enabled feedback — satisfying risein Level 4.

**Architecture:** Thin per-user frontend layer over the already-parametric treasury contract. A shared StellarWalletsKit instance + a `walletSigner` adapter drives both the wallet view and contract calls. A new `Workspace` view (connected) sits beside the preserved showcase `Dashboard` (unconnected). Treasury id per wallet is kept in localStorage.

**Tech Stack:** React 19 + Vite + TypeScript, `@stellar/stellar-sdk` ^14.6.1 (`/contract`), `@creit.tech/stellar-wallets-kit` ^2.3.0, Vitest, Supabase (feedback).

## Global Constraints

- Network: **Stellar testnet** only. `NETWORK_PASSPHRASE = "Test SDF Network ; September 2015"`.
- Treasury token: **native XLM SAC** `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`.
- Treasury WASM hash (installed on-chain): `41c8bb1f0b4d9bd7b89c3a855ee87cb56971a256fe110cd2860d406dde040c2b`.
- agent = admin = connected wallet (the "(b)" path). No embedded signing key in the user flow.
- Do not modify the contract crates. Do not remove the showcase demo (`Dashboard`).
- Follow existing code style (English comments, typed errors, retry-on-transient).
- USDC 7 decimals → XLM stroops: 1 XLM = 10_000_000.
- Commit after each task; push at the end of a working group.

---

### Task 1: Shared wallet kit + signer adapter

**Files:**
- Create: `web/src/lib/walletKit.ts`
- Test: `web/src/lib/walletKit.test.ts`
- Modify: `web/src/components/Wallet.tsx` (consume the shared kit instead of its own instance)

**Interfaces:**
- Produces: `kit` (the single `StellarWalletsKit`), `connect(): Promise<string>`, `disconnect(): Promise<void>`, `getAddress(): string | null`, and `makeWalletSigner(address: string)` returning `{ signTransaction: (xdr, opts?) => Promise<{ signedTxXdr: string; signerAddress: string }> }` — matches the `@stellar/stellar-sdk/contract` `ClientOptions.signTransaction` shape so it can drive `Client.deploy` and contract method calls.

- [ ] **Step 1: Failing test** — `makeWalletSigner` returns an object whose `signTransaction` calls `kit.signTransaction` with the right passphrase + address and maps `{ signedTxXdr }` → `{ signedTxXdr, signerAddress }`. Mock `kit.signTransaction` to return `{ signedTxXdr: "SIGNED" }`; assert the adapter returns `{ signedTxXdr: "SIGNED", signerAddress: "<addr>" }` and was called with `{ networkPassphrase: NETWORK_PASSPHRASE, address: "<addr>" }`.
- [ ] **Step 2:** Run `cd web && npm test -- walletKit` → FAIL (module not found).
- [ ] **Step 3:** Implement `walletKit.ts`: move the `StellarWalletsKit.init({...modules})` + `setTheme(...)` block out of `Wallet.tsx`; export `kit`, `connect`/`disconnect`/`getAddress` (track address in a module variable + `sessionStorage` as today), and `makeWalletSigner(address)`.
- [ ] **Step 4:** Run `cd web && npm test -- walletKit` → PASS.
- [ ] **Step 5:** Refactor `Wallet.tsx` to import `kit`/`connect`/`disconnect` from `walletKit.ts` (delete its local `StellarWalletsKit.init`/`setTheme`). Run `cd web && npm run build` → typechecks; manual: wallet connect + send still works.
- [ ] **Step 6:** Commit `feat(web): shared wallet kit + contract signer adapter`.

---

### Task 2: Per-user treasury store (address → contract id)

**Files:**
- Create: `web/src/lib/treasuryStore.ts`
- Test: `web/src/lib/treasuryStore.test.ts`

**Interfaces:**
- Produces: `getTreasuryId(address: string): string | null`, `setTreasuryId(address: string, id: string): void`, `clearTreasuryId(address: string): void`. Backed by `localStorage["prism_treasury:<address>"]`.

- [ ] **Step 1: Failing test** — set then get returns the id; get for an unknown address returns null; clear removes it. Use a localStorage mock (`vitest` jsdom env or a small in-memory shim).
- [ ] **Step 2:** Run `cd web && npm test -- treasuryStore` → FAIL.
- [ ] **Step 3:** Implement the three functions with the `prism_treasury:` key prefix.
- [ ] **Step 4:** Run `cd web && npm test -- treasuryStore` → PASS.
- [ ] **Step 5:** Commit `feat(web): per-wallet treasury id store (localStorage)`.

---

### Task 3: Per-user treasury operations

**Files:**
- Create: `web/src/lib/userTreasury.ts`
- Test: `web/src/lib/userTreasury.test.ts` (pure helpers only)

**Interfaces:**
- Consumes: `makeWalletSigner` (Task 1), treasury `Client` from `./treasuryClient`, `XLM_SAC`/`TREASURY_WASM_HASH` constants.
- Produces:
  - `deployTreasury(address, signer, dailyXlm: number, perTaskXlm: number): Promise<string>` — `Client.deploy({admin: address, agent: address, token: XLM_SAC, daily_limit, per_task_limit}, {wasmHash, networkPassphrase, rpcUrl, publicKey: address, signTransaction})` → returns new contract id.
  - `makeTreasury(contractId, address, signer): Client` — a `Client` bound to a runtime contract id + wallet signer (the per-user analogue of `prism.ts`).
  - `fundTreasury(contractId, address, signer, amountXlm): Promise<string>` — native XLM SAC `transfer(from: address, to: contractId, amount)` via the token contract `Client`/`Contract`, wallet-signed; returns tx hash.
  - `addPayee/removePayee(treasury, payee): Promise<string>`, `pay(treasury, taskId, to, amountXlm): Promise<PayResult>` (reuse the `agentPay` retry/contract-error logic from `prism.ts`, generalised), `readState(treasury): Promise<PrismState>`.
  - Pure helpers (tested): `toStroops(xlm: number): bigint`, `parseDeployedId(...)`, `buildTransferArgs(from, to, stroops)`.

- [ ] **Step 1: Failing test** — `toStroops(1.5) === 15_000_000n`; `toStroops(0) === 0n`; rejects negative. `buildTransferArgs` returns `[Address from, Address to, i128 amount]` in the SAC `transfer` order.
- [ ] **Step 2:** Run `cd web && npm test -- userTreasury` → FAIL.
- [ ] **Step 3:** Implement the pure helpers + the async ops (async ops are exercised by the live E2E in Task 7, not unit tests — Soroban calls aren't unit-mockable here).
- [ ] **Step 4:** Run `cd web && npm test -- userTreasury` → PASS (pure helpers).
- [ ] **Step 5:** `cd web && npm run build` → typechecks.
- [ ] **Step 6:** Commit `feat(web): per-user treasury ops (deploy/fund/policy/pay/read)`.

---

### Task 4: Workspace view (connected user)

**Files:**
- Create: `web/src/components/Workspace.tsx`
- Modify: `web/src/App.tsx` (route connected → Workspace, unconnected → landing/Dashboard)

**Interfaces:**
- Consumes: `connect/getAddress` (Task 1), `treasuryStore` (Task 2), `userTreasury` (Task 3).
- Produces: a self-contained connected experience with sub-states: `no-treasury` (create form: daily + per-task inputs), `has-treasury` (state panel: balance, day-spent vs daily, per-task limit; fund form; add-payee form; spend form: payee + amount). Explicit loading / empty / error states. Contract guardrail errors (`#1..#8`) shown as informative messages.

- [ ] **Step 1:** Implement `Workspace.tsx` with the create→fund→policy→spend flow, calling Task 3 ops. Each action: optimistic "signing…" state → success (tx link) or typed error. Re-read state after each successful action.
- [ ] **Step 2:** Wire `App.tsx`: add a top-level connect button; when connected, resolve `getTreasuryId(address)` → render `Workspace`; keep `Dashboard` as the unconnected showcase + landing. Reuse the existing nav/lazy patterns.
- [ ] **Step 3:** `cd web && npm run build` → typechecks. Manual: connect → create treasury (sign) → state panel renders.
- [ ] **Step 4:** Commit `feat(web): user workspace — create/fund/govern/spend your treasury`.

---

### Task 5: Re-enable feedback (diagnose live submit failure)

**Files:**
- Modify: `web/src/components/FeedbackButton.tsx` / `FeedbackModal.tsx` (attach connected wallet address; remount app-wide)
- Investigate: Supabase `feedback` table RLS + production env (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)

**Interfaces:**
- Consumes: `submitFeedback` (already implemented), `getAddress` (Task 1).

- [ ] **Step 1:** Reproduce live: open `prism-stellar.vercel.app`, submit feedback, read the network/console error. Determine if it's missing env, RLS reject, or schema mismatch (check via Supabase MCP: `list_tables`/`get_advisors` on project `gspgddphkommgjuipfzz`).
- [ ] **Step 2:** Fix the root cause: if RLS, add an anon `insert` policy; if env, add the Vercel env vars; if schema, align column names. Verify the `feedback` table has columns `rating, valuable_feature, improvement_text, would_use_production, handle, wallet_address`.
- [ ] **Step 3:** Pass the connected wallet address into the feedback payload (`getAddress()`), so submissions tie to real users.
- [ ] **Step 4:** Live verify: a real submission succeeds and the row appears (`execute_sql` count). [[feedback_verify_live_not_mock]]
- [ ] **Step 5:** Commit `fix(web): feedback submit works end-to-end + ties to wallet`.

---

### Task 6: Analytics & monitoring

**Files:**
- Create: `web/src/components/Analytics.tsx`
- Create: `web/src/lib/analytics.ts` + `web/src/lib/analytics.test.ts`
- Modify: `web/src/lib/events.ts` (make the watched contract id parametric so it can follow the user's treasury)

**Interfaces:**
- Produces: `lib/analytics.ts` pure reducers over `FeedEvent[]`: `spendSeries(events): {at: string; xlm: number}[]`, `violationCount(errors): number`, `agentScorecard(events): {payments: number; totalXlm: number; lastAt: string | null}`. A lightweight client error tracker `trackError(msg)` / `getErrors(): {count: number; last: string | null}` (module store). `Analytics.tsx` renders these for the connected treasury.
- Modify `events.ts`: `fetchEventsPage(server, { contractIds, startLedger?, cursor? })` (default to `[TREASURY_ID, VERIFIER_ID]` when omitted, preserving current callers).

- [ ] **Step 1: Failing test** — `spendSeries` sums `paid` amounts by timestamp; `agentScorecard` counts payments + totals XLM + tracks last; `trackError` increments and stores the last message.
- [ ] **Step 2:** Run `cd web && npm test -- analytics` → FAIL.
- [ ] **Step 3:** Implement `analytics.ts` reducers + error tracker; make `events.ts` `contractIds` parametric.
- [ ] **Step 4:** Run `cd web && npm test -- analytics` → PASS.
- [ ] **Step 5:** Build `Analytics.tsx` (spend trend, payment count, violations, last activity) into the Workspace.
- [ ] **Step 6:** `cd web && npm run build`. Commit `feat(web): analytics + monitoring (spend trend, violations, error tracking)`.

---

### Task 7: Live E2E + deploy

- [ ] **Step 1:** Run `cd web && npm run dev`; full manual run on testnet with a real Freighter wallet: connect → create treasury (sign) → fund (sign) → add payee (sign) → pay in-policy (success, tx link) → pay over per-task (rejected `#3`) → pay over daily (rejected `#4`) → history + analytics update → feedback submit. Capture screenshots (Product UI, mobile, analytics).
- [ ] **Step 2:** Fix anything the E2E surfaces (the `walletSigner` adapter is the likeliest issue — validate it against the deploy tx first).
- [ ] **Step 3:** `cd web && npm run build` then `vercel --prod --cwd web` ([[feedback_prism_vercel_manual_deploy]]); verify the live URL `prism-stellar.vercel.app` ([[feedback_verify_live_not_mock]]).
- [ ] **Step 4:** Commit + push the working group.

---

### Task 8 (optional, if time): 8004 reputation passport

- [ ] Surface each treasury's reputation policy + let high-reputation payees be paid without whitelist (the contract's `set_reputation_policy` + reputation-gate already exist). Wire `REG_REPUTATION` reads into the Workspace. Commit `feat(web): 8004 reputation passport`.

---

## Post-build (not code)
- README: add a "Using Prism (Level 4)" section — connect → create → fund → spend, with the new screenshots + a "10 users" note.
- Distribute the live link to the WhatsApp ambassador group; collect ≥10 wallet-interaction txs + feedback.
- Submit Level 4 once proof + feedback summary are in hand.
