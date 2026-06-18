# Prism Confidential — Zero-Knowledge Compliance Layer

**Date:** 2026-06-18
**Author:** Bekir Erdem
**Status:** Approved design — ready for implementation plan
**Target:** [Stellar Hacks: Real-World ZK](https://dorahacks.io/hackathon/stellar-hacks-zk) (DoraHacks / SDF). Submission deadline **2026-06-29 12:00 PM PST**. Single open track, $10k pool ($5k/$2k/$1.25k/$1k/$750).
**Secondary target:** [Rise In — Stellar Journey to Mastery](https://www.risein.com/programs/stellar-journey-to-mastery-monthly-builder-challenges) Startup Track (no fixed deadline; same artifact, submitted after the hackathon build).

---

## 1. Summary

Prism today is a non-custodial Soroban treasury that lets a business hand an AI agent real money to spend, where the **contract** enforces a policy (payee whitelist, per-task limit, daily limit) and rejects violations on-chain. Every payment is currently **transparent**: `pay(task, to, amount)` exposes `to` and `amount` in contract storage and events.

**Prism Confidential** adds a zero-knowledge layer: the agent's payments are hidden behind cryptographic **commitments**, and a single **Groth16 proof — verified on-chain by a Soroban contract — attests that the whole batch obeyed the policy without revealing any amount or payee.**

Value proposition: **same guarantees, zero disclosure.** A business proves to an auditor / counterparty / regulator that its agent never violated policy, without exposing what it spent, on what, or with whom.

This is a textbook fit for the hackathon: the organizers' own idea list names "confidential payroll/invoicing", "compliant private transfer with view key", "private allowlist membership (Merkle proof)", and "proof-of-balance (range proof)" — and states payments + ZK projects are "especially welcome." The ZK is **load-bearing**: it is the only thing that lets an outsider trust compliance without seeing the ledger.

## 2. Scope

**In scope (this spec — the core ZK build):**
- A Circom compliance circuit (range + sum + Merkle membership over a fixed-size batch).
- A Soroban `compliance_verifier` contract (forked from the official SDF Groth16 verifier) that verifies the proof on-chain and emits an attestation.
- A TypeScript prover/serialization package (snarkjs → Soroban byte format → verify tx).
- Tests + a real testnet verification transaction as on-chain proof.

**Deferred (follow-up phases, by user decision):**
- **Frontend "Confidential Mode" panel** — functional surface + data flow are owned here, but visual direction is Bekir + Gemini, specced separately, built after the core ZK works.
- **Rise In Startup Track submission** — uses the same product/artifact; done after the hackathon build (no fixed deadline).

**Explicitly out of scope (roadmap):**
- Full shielded settlement (privacy pool with nullifiers / UTXO notes / withdrawals). This spec is a clean stepping stone to it, not the thing itself.

## 3. Toolchain decision (researched, fixed)

**Circom + snarkjs (Groth16 over BLS12-381).** Rationale:
- It is the only mainstream toolchain whose proof curve **natively matches** Soroban's BLS12-381 pairing host functions (`circom --prime bls12381`).
- The on-chain verifier already exists as **official SDF code** to fork: [`stellar/soroban-examples/groth16_verifier`](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier).
- Range proofs + Merkle membership are standard `circomlib`.
- **Off-chain fallback** is the same circuit + proofs verified via `snarkjs groth16 verify` — zero pipeline rework if the on-chain serialization slips.

**Platform basis:** BLS12-381 host functions (CAP-0059, Protocol 22, mainnet Dec 2024); BN254 + Poseidon added later (Protocol 25 "X-Ray" / 26 "Yardstick"). A Groth16 verify costs ~40M instructions (~40% of the per-tx CPU budget), fits in one transaction, sub-cent fee. On-chain SNARK verification difficulty assessed at ~3–4/10 for this build.

**Reference repos:** `jamesbachini/CircomStellar` (snarkjs→Soroban byte encoder + testnet demo), `mysteryon88/soroban-verifier-gen` (auto-generates a curve-correct verifier crate from a `verification_key.json`), `stellar/soroban-examples/privacy-pools` (Groth16 + Poseidon + Merkle reference architecture), `erhant/circomkit` (dev harness).

**Build environment:** WSL2 (circom, snarkjs, the `stellar` CLI). Keep `.ptau` files on the WSL filesystem; `NODE_OPTIONS=--max-old-space-size=8192`.

## 4. The proven statement

For a fixed batch of `N` payments (N = 8 for the demo, padded with null entries):

```
Public inputs:   daily_limit, per_task_limit, whitelist_root, period_id, C[0..N-1]
Private inputs:  amount[i], payee[i], salt[i], merklePath[i][], pathIndices[i][]

Constraints:
  ∀i:  C[i] == Poseidon(amount[i], payee[i], salt[i])     // commitments bind the proof
  ∀i:  amount[i] ≤ per_task_limit                          // range proof (per-task)
       Σ amount[i] ≤ daily_limit                           // aggregate ≤ daily limit
  ∀i:  payee[i] ∈ whitelist (Merkle path → whitelist_root) // membership
```

The public commitments `C[i]` bind the proof to specific committed payments, so a valid proof certifies *those* payments were policy-compliant, while their amounts and payees stay private.

**Soundness footgun (must enforce):** every `LessEqThan` comparison input must be range-bounded with `Num2Bits` first, or the comparison is forgeable via field wrap-around. Payment amounts fit well under 252 bits. Each constraint must be enforced with `=== 1`, not merely read as an output.

## 5. Components (isolated, single-purpose)

| Component | Path | Responsibility | Depends on |
|---|---|---|---|
| Compliance circuit | `circuits/compliance.circom` | Express the proven statement; compile to R1CS + WASM witness gen | circomlib (Poseidon, comparators, Merkle) |
| Verifier contract | `contracts/compliance_verifier/` | Verify Groth16 proof on-chain via `bls12_381_multi_pairing_check`; emit attestation | forked SDF `groth16_verifier`; verifying key |
| Existing treasury | `contracts/treasury/` | **Unchanged.** Serves as "public mode" for contrast | — |
| Prover package | `packages/prover/` | Batch → witness → Groth16 proof + public signals → Soroban byte serialization → verify tx; off-chain `snarkjs verify` fallback | snarkjs; CircomStellar/soroban-verifier-gen encoder; stellar-sdk |
| Frontend panel *(deferred)* | `web/src/components/Confidential*.tsx` | Confidential-mode UX; reads `ComplianceAttested` events | prover output; treasury client |

**Verifier contract surface (draft):**
- Constructor sets the verifying key (VK) for the compiled circuit.
- `verify(proof, public_inputs) -> ()` runs the pairing check; on success stores/emits `ComplianceAttested(period_id, whitelist_root, n, proof_hash)`; on failure, traps (rejects the tx).
- The verified attestation is the **gate**: a period is only marked compliant/finalizable once its proof verifies on-chain. This is what makes the ZK load-bearing rather than decorative.

## 6. Data flow

```
agent payment batch
   → prover builds witness (amount, payee, salt, merkle paths)
   → snarkjs Groth16 proof + public signals (limits, whitelist_root, commitments)
   → serialize to Soroban bytes (G2 c1/c0 order, negate A, big-endian)
   → compliance_verifier.verify(proof, public_inputs)   [Soroban testnet]
   → bls12_381_multi_pairing_check
   → ComplianceAttested event
   → (frontend, later) reads attestation; amounts/payees never revealed
```

## 7. Honesty note (goes in README verbatim-equivalent)

The ZK layer hides **Prism's compliance ledger** — Prism's own storage and events carry only commitments and a proof, never plaintext amounts or payees. If confidential mode also moves real USDC via SAC transfers to revealed payees at settlement, those transfers remain visible at the **token-contract layer**; transfer-level privacy is the shielded-pool roadmap (out of scope here). For the demo, real fund movement is shown in the contrasting **public mode**, while confidential mode focuses on commitments + the on-chain-verified compliance proof. The hackathon explicitly rewards honest work-in-progress over a "polished mystery."

## 8. Verification criteria (goal-driven)

- **Circuit tests** (snarkjs / circom_tester):
  - valid batch → proof verifies;
  - sum over daily limit → witness/constraint fails;
  - one amount over per-task limit → fails;
  - a non-whitelisted payee → fails;
  - a tampered commitment (C[i] ≠ Poseidon(...)) → fails.
- **Verifier contract** (`cargo test`): valid proof → `ComplianceAttested`; invalid/garbage proof → trap/reject.
- **On-chain proof:** one real Stellar **testnet** `verify` transaction, linked on Stellar Expert, demonstrating verification on-chain (the killer demo). Off-chain `snarkjs groth16 verify` kept as the documented fallback path.
- **E2E:** prover → testnet verify → attestation event observed.

## 9. Risk register (no time estimates — risk levels)

| Item | Risk | Mitigation |
|---|---|---|
| snarkjs → Soroban serialization (G2 c1/c0, negate-A, big-endian) | **high** | Use `soroban-verifier-gen` / `CircomStellar` encoder rather than hand-rolling; spend the risk budget here first |
| WSL2 toolchain setup on Windows | medium | One-time; documented in build phase |
| Circuit soundness (`Num2Bits` bounding before every compare) | medium | Enforce `=== 1`; bound all comparison inputs; test forgery cases |
| No public BLS12-381 powers-of-tau | low | Self-generate Phase 1 (`snarkjs powersoftau new bls12-381`); fine for testnet |
| Verifier fork + VK wiring | low | Official SDF code; swap VK + public-signal layout |

## 10. Sequencing

1. Core ZK build (this spec): circuit → verifier contract → prover → tests → testnet verify tx.
2. Demo video (2–3 min) + README update (incl. honesty note) for the hackathon BUIDL submission.
3. Frontend "Confidential Mode" panel (separate spec; visual = Bekir + Gemini).
4. Rise In Startup Track submission (same product/artifact, post-build).
```
