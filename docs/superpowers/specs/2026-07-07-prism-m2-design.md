# Prism — M2 Agent Infrastructure (treasury v3 + registry)

**Date:** 2026-07-07
**Status:** Approved design, ready for implementation
**Goal:** Close the gap between "a human signs every payment" and "an agent spends
autonomously, safely" — ship ROADMAP M2 in one sprint: **session-key agent signing**,
**contract lifecycle** (pause / admin withdraw / limit updates / agent rotation),
**on-chain treasury registry**, and a **rolling 24h daily-limit window**. All treasury
changes land in a single **v3 wasm**; the registry is a separate new contract.

---

## 1. Context

The per-user product deploys treasuries with `admin = agent = the user's wallet`, so the
core "autonomous agent, contract-enforced safety" story only lives in the spectator demo.
The contract has no exit or emergency path (no withdraw, no pause, no limit updates —
SECURITY.md C4), discovery is localStorage-only, and the daily limit resets at the fixed
UTC midnight, allowing up to 2× the limit across the boundary (SECURITY.md C2).

Two decisions anchor this design:

- **One sprint, one v3 wasm.** Contracts are immutable; shipping the pieces separately
  would mean multiple installs and fragmented user treasuries.
- **No upgrade path — the contract stays immutable.** An `upgrade` entrypoint would turn
  "the contract, not the admin, enforces the rules" into "trust the admin". The exit
  story is `pause` + `admin_withdraw` + deploy-a-new-treasury.

## 2. Goals / Non-Goals

**Goals (this sprint):**
- Time-bound, spend-capped, instantly-revocable **agent session** per treasury (`agent ≠ admin`).
- Lifecycle: `set_paused`, `admin_withdraw`, `set_limits`, `set_agent`.
- Rolling 24-hour spend window (closes C2); constructor/limit validation (closes C5).
- Permissionless **TreasuryRegistry** contract: wallet → treasury ids, used by the web
  app for cross-device recovery.
- Web: Controls section (pause/withdraw/limits), Agent-session section with a no-popup
  **Run autonomous task** action, registry-backed recovery. Functional layer only — the
  premium visual pass stays with Bekir.

**Non-Goals (explicitly out of scope):**
- Contract upgradeability (decided against — see Context).
- Multiple concurrent sessions per treasury (YAGNI — one agent per treasury is the model).
- `unregister` on the registry (discovery data, not funds; dead ids are filtered client-side).
- Storage TTL management (C3 — M3 mainnet hardening).
- Mainnet fee sponsorship / fee-bump for session accounts (M3; testnet uses friendbot).
- ZK wiring into the payment flow (M4).

## 3. Treasury v3 design

### 3.1 Session — one active session, single-spender rule

```rust
pub struct Session { pub agent: Address, pub valid_until: u64, pub limit: i128, pub spent: i128 }
// DataKey::Session (instance)
```

- `set_session(agent, valid_until, limit)` — admin-only; rejects `limit <= 0` or
  `valid_until <= now` with `#11 InvalidLimits`. Overwrites any previous session
  (**rotation resets `spent`**).
- `revoke_session()` — admin-only, instant.
- While a session is **active** (exists && `now < valid_until`), the spender for
  `pay` / `create_escrow` / `refund_escrow` is **only** `session.agent`. Otherwise the
  root `cfg.agent` is the spender (per-user treasuries deploy with `admin = agent`, so
  existing behaviour is unchanged until a session is started).
  - *Why single-spender:* Soroban's `require_auth` cannot be try-caught; an
    "either-of-two" authorisation needs a `spender` parameter (ABI break) or ambiguous
    auth. Single-spender is auditable and matches the product: while an agent session
    runs, the agent is the spender — the browser holds the session key, so even manual
    Spend goes through it without popups.
- Session `spent` is charged at **commitment time** (`pay` and `create_escrow`), not at
  release; a refund does **not** restore session budget (conservative, simple).
- Session cap and the rolling daily window are **independent gates** — both apply.
- There is deliberately **no `SessionExpired` error**: an expired session falls back to
  the root agent, so the contract can never produce it.

### 3.2 Rolling 24h window (closes C2)

- `DataKey::HourSpent(u64)` (persistent), `hour = timestamp / 3600`;
  `rolling_spent = Σ buckets[now_hour - 23 ..= now_hour]`.
- Checked **and** recorded in both `pay` and `release_escrow`.
- `day_spent()` keeps its signature; its meaning becomes "spent in the last 24 hours"
  (client-compatible; UI label becomes "Last 24h").
- `DataKey::DaySpent` is **deleted** in v3 — no upgrade path means no migration concerns.
- TTL note: a bucket inside the window is at most 24h old while persistent min-TTL is
  weeks, so in-window archival is impossible; expired buckets are simply never read again.
- Footprint: ~31–33 read entries per `pay` (24 buckets + instance + escrow/task keys) vs
  the ~40/tx limit — verified with a live simulation in step 3; fallback is 6×4h buckets
  (single constant change).

### 3.3 Lifecycle

- `set_paused(bool)` (admin): pause rejects `pay`, `create_escrow`, `release_escrow`
  with `#9 Paused`. **`refund_escrow`, `admin_withdraw`, and every admin setter keep
  working** — exit and incident-response paths are never locked.
- `admin_withdraw(to, amount)` (admin): `#1` on non-positive, `#6` beyond the free
  (unlocked) balance. **Not counted** in the rolling window and **not payee-gated**: the
  window bounds *delegated* (agent) spending; the owner reclaiming their own funds with
  their own signature must work precisely when limits are exhausted. Escrow-locked funds
  stay locked (the payee commitment survives; refund is the escape).
- `set_limits(daily, per_task)` (admin): effective immediately; validates
  `daily > 0 && per_task > 0 && per_task <= daily` → `#11 InvalidLimits`. The **same
  validation moves into `__constructor`** (`panic_with_error!`) — closes C5.
- `set_agent(agent)` (admin): rotates the root agent (ROADMAP asks for key rotation
  explicitly; the session covers delegation, this covers root-key loss).

### 3.4 Error codes and gate order

New errors: `Paused = 9`, `ExceedsSessionLimit = 10`, `InvalidLimits = 11`.

`pay()` gate order (fixed, tests depend on it):
`auth → paused(#9) → amount>0(#1) → payee(#2/#5) → per-task(#3) → session-cap(#10) →
rolling-24h(#4) → free-balance(#6) → CEI effects (HourSpent + TaskSpent + Session.spent) →
transfer → event`.

Events (`symbol_short!`): `paused`, `withdrawn`, `limits`, `session`, `revoked`, `agent`.

## 4. TreasuryRegistry (new contract)

Permissionless, admin-less, constructor-less discovery index:

```rust
register(owner: Address, treasury: Address)   // owner.require_auth(); dedupe on contains
treasuries_of(owner: Address) -> Vec<Address> // view; empty vec for unknown owners
// DataKey::Owned(Address) -> Vec<Address> (persistent) · event: ("regd", owner) -> treasury
```

Only the owner can write their own list (and pays their own rent), so no cap or admin is
needed. Web flow: after a successful deploy, a **best-effort** second wallet-signed
`register` tx (a decline falls back to localStorage silently); on connect, if
localStorage has no treasury for the wallet, `treasuries_of` is simulated (unsigned) and
the most recent id is adopted.

## 5. Old-treasury coexistence

v3 is a pure **addition** to the existing ABI (`pay` / `get_config` / `day_spent` /
escrow signatures unchanged), so the single regenerated client serves v1/v2.1/v3 alike.
The Workspace probes once per treasury with a `get_session` simulation: failure ⇒
`legacy = true` ⇒ session/lifecycle sections are hidden behind an "older version —
deploy a new treasury for M2 features" note. No `version()` entrypoint (the probe already
answers the question).

## 6. Web session UX

- Session key = `Keypair.random()` in the browser; secret stored at
  `localStorage["prism_session:<treasuryId>"]`. Testnet-appropriate: the *point* of the
  design is a bounded credential (cap + expiry + revoke) whose compromise is survivable.
- The session account **must be friendbot-funded**: it is the tx source for autonomous
  payments (accounts must exist and pay fees). The wallet-as-source alternative would
  re-introduce a popup per payment, defeating the purpose. Mainnet path: fee-bump /
  sponsorship (M3).
- Flow: **[Start agent session]** → generate keypair → friendbot → wallet-signed
  `set_session(pk, now + duration, cap)` → store secret. Afterwards payments sign with
  `basicNodeSigner` (same pattern as the demo agent in `prism.ts`) — **no popups**.
- While a session is active, manual Spend routes through the session signer too
  (single-spender rule); **[Run autonomous task]** demonstrates a zero-popup payment with
  a live tx link. Losing the secret (cleared storage) ⇒ wallet-signed `revoke_session` +
  start a new one.

## 7. Security notes

- C2 (midnight 2× burst): **closed** by 3.2 — proof test `c2_day_boundary_no_longer_doubles`.
- C4 (no exit): **closed** by 3.3 (`admin_withdraw` + `set_paused`).
- C5 (no constructor bounds): **closed** by 3.3 validation.
- The contract remains **immutable by design**; the trust model is unchanged.
- Session secrets in localStorage are testnet scope; revocation + caps bound the blast
  radius. The existing build-time non-testnet guard still applies to the demo key.
