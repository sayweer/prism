# PRISM Commitment Accumulator — Design (2026-07-09)

> Resolves audit finding 1 (`circuits/AUDIT-NOTES.md`): today the attestation proves a
> *declared* batch complies with the anchored policy; nothing binds the circuit's
> commitments to the payments the treasury actually executed. Status: **design — not
> yet implemented.** Target: treasury v3.2 + verifier v2.

## Problem

The circuit proves "a compliant batch exists". The verifier anchors the *policy* but not
the *flows*: the prover builds its input from a local JSON, and `pay()` emits plaintext
events without any commitment. A malicious (or buggy) agent could attest a compliant
phantom batch while spending differently. We currently label this honestly as a
"reference attestation" — this design upgrades it to **"the payments this treasury
actually executed in period P complied with the anchored policy."**

## Goal & non-goals

**Goal (Phase A — integrity):** bind attestations to real on-chain flows. Everything
stays transparent (amounts/payees are already public in `pay()`); the commitment's job
here is *binding*, not *hiding*.

**Non-goals:** confidential transfers (that is the OZ confidential-token line — Phase B,
separate); real-time in-app proving; any change to policy semantics or circuit
constraints. **Phase A requires zero circuit changes and zero VK changes.**

## Key enabler (verified 2026-07-09)

Protocol 25 ships a **Poseidon permutation host function** — `soroban-sdk 26.0.1`
`CryptoHazmat::poseidon_permutation(input, field, t, d, rounds_f, rounds_p, mds,
round_constants)` behind the `hazmat-crypto` feature, plus Stellar's higher-level
[`rs-soroban-poseidon`](https://github.com/stellar/rs-soroban-poseidon) crate. Since all
parameters are caller-supplied, the treasury can reproduce **circomlib's exact Poseidon**
(BN254, t=4 for 3 inputs, d=5, RF=8/RP=56, circomlib MDS + round constants) on-chain.
→ First implementation step: check whether `rs-soroban-poseidon` offers a
circomlib-parameterised construction; if not, embed circomlib constants and use hazmat.

## Design

### 1. Treasury v3.2 — record commitments at pay time

- In `pay()`, after checks and before/with the transfer, compute
  `C = Poseidon(amount, payee_fr, salt)` on-chain and append it to
  `DataKey::PeriodCommits(period, chunk)` (`Vec<BytesN<32>>`), and include `C` in the
  `paid` event.
- `release_escrow()` records the same way at **release** time (that is when value
  actually leaves toward the payee). `create_escrow` does not record; `refund_escrow`
  and `admin_withdraw` are out of scope (not agent spending).
- **`period`** = `unix_day(ledger.timestamp)`, **`chunk`** = batch index within the day:
  when a chunk reaches N (=8, the circuit batch size), the next payment opens chunk+1.
  The proof's `periodId` public input becomes `Fr(period · 2^16 + chunk)` (encoding
  documented in one place, shared by contract and prover).
- **Storage:** persistent entries per (period, chunk), TTL-extended on write; bounded by
  real activity (max 8 hashes per entry).

### 2. Verifier v2 — bind the batch to the recorded flows

- `__constructor` gains a `treasury: Address` anchor (alongside the policy). This
  deploy also picks up the finding-2 bit-width assert already on main (`d6f315e`) —
  one address churn covers both.
- `verify()` gains, after the policy and replay checks: cross-contract call
  `treasury.commitments_of(period, chunk)` → require the proof's public
  `commitments[0..k]` to equal the recorded list **prefix-exactly, in order**
  (k = recorded count).
- **Why prefix (not exact-8) is sound:** slots k..8 are prover padding. A prover cannot
  *omit* a real payment (all k recorded must appear), cannot *reopen* a commitment
  (Poseidon binding), and any extra non-zero slot only *increases* the proven total and
  must still pass the whitelist check — so compliance of the real flows is implied
  a fortiori. This is what lets the circuit stay untouched.
- Replay guard key becomes the (period, chunk)-encoded `periodId` — unchanged mechanics.

### 3. Prover — build the batch from chain, not from JSON

- New `prove.ts --from-chain` mode: read the period's `paid` events (amount, payee,
  commitment), recompute salts (deterministic — below), verify recomputed commitments
  match the recorded ones, then prove as today. Local-JSON mode stays for tests.

### Design decisions locked here

- **D1 — canonical payee→Fr encoding (currently undefined; prover uses free bigints):**
  `payee_fr = U256(sha256(payee.to_xdr())) mod r` (BN254 scalar field). Computable
  cheaply on-chain (sha256 host fn + mod) and off-chain; one named constant/function in
  BOTH codebases + a shared test vector. Whitelist Merkle leaves switch to this same
  encoding — **whitelist root must be regenerated** when v3.2 goes live.
- **D2 — salt (transparent phase):** deterministic public
  `salt = Poseidon(period_id_fr, seq)`. Hiding is not a Phase A goal; keeping the salt
  slot means Phase B can make it secret without touching the circuit.
- **D3 — multi-batch days:** chunking as in §1 (day, chunk) rather than rejecting the
  9th payment or growing N.
- **D4 — binding rule:** prefix-exact match as in §2 (no multiset logic, no circuit
  selector logic).

## What this buys (strategy tie-in)

- Attestation claim upgrades from "declared batch" to "actual flows" — the strongest
  version of PRISM's load-bearing-ZK story for SCF/Startup Track.
- Answers the central bridge question of the Avalanche `BoundedAgentAccount` design
  with a working Stellar prototype (same circuit, EVM verifier there).
- Deep-dive material for the yamancan meeting and the ZK-hardening blog part 2.

## Risks / open items

1. **Circomlib parity is the whole game:** an on-chain Poseidon that differs from
   circomlibjs by any constant silently breaks everything. Gate the work on a
   cross-implementation test vector suite (same inputs → identical hashes across
   circomlibjs / on-chain host fn / prover).
2. **Cost budget:** t=4 Poseidon per payment (constants as consts in wasm or instance
   storage — measure both) + one cross-contract read in `verify()`. Measure with
   `cost_estimate` before committing to per-payment hashing; fallback if over budget:
   record `(amount, payee_fr, salt)` plaintext on-chain and let the *verifier* hash via
   host fn at verify time (8 hashes once per attestation instead of 1 per payment).
3. **Migration:** new treasury wasm (v3.2 install; existing user treasuries stay legacy,
   app detects — same pattern as v3/v3.1), new verifier address; update DEPLOYMENT.md,
   README, SKILL.md addresses. Old attestation flow remains valid history.
4. **Sequencing (agreed 2026-07-09):** design now; **implementation after L4 user wave
   submits** — no contract churn mid-distribution.

## Test plan (implementation gate)

- Unit: recording on pay/release; chunk rollover at 8; prefix-binding accept/reject
  (missing recorded → reject, reordered → reject, extra padding → accept); D1 encoding
  vector; deterministic salt vector.
- Cross-impl: circomlibjs ↔ on-chain Poseidon parity on fixed vectors (**blocker test —
  write first**).
- E2E (testnet): 3 real payments → `--from-chain` proof → attestation; then tamper each
  binding rule and watch it trap.
