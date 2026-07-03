# Changelog

Notable changes to PRISM, grouped by release wave. Full detail lives in the
[conventional-commit history](https://github.com/Bekirerdem/prism/commits/main);
deployed addresses and on-chain proofs in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## [0.3.1] — 2026-07-02 · Onboarding & UX hardening

First-real-users wave: everything a cold wallet hits in its first five minutes.

- **Added** — testnet funding gate (friendbot one-click for empty wallets) · treasury-ID
  copy + save hint + contract-id validation · sample-vendor payee fill + spend prefill ·
  global wallet chip in a redesigned nav (connect / copy / disconnect, shared across
  landing and app) · hash routing (refresh keeps the current view) · Turkish quickstart
  ([`docs/TRY-IT-TR.md`](docs/TRY-IT-TR.md)) · [`ROADMAP.md`](ROADMAP.md) · [`SECURITY.md`](SECURITY.md)
- **Fixed** — activity feed now watches the connected user's own treasury and pages
  `getEvents` to the ledger head (day-wide windows span multiple RPC pages) · wallet view
  hydrates the shared connection · deploy/fund/whitelist/pay errors surface in human
  language · mobile nav no longer hides all links · fixed-width spend bars
- **Docs** — README refocused on the product (Level 1-3 requirement-proof sections removed,
  per-user product screenshots added) · honest testnet-USDC/XLM scope

## [0.3.0] — 2026-07-01 · Per-user product (Level 4)

From spectator demo to a product you can use with your own wallet.

- **Added** — connect any Stellar wallet → deploy **your own** bounded treasury
  (non-custodial, native XLM) → fund → whitelist payees → spend; policy violations rejected
  on-chain · analytics & monitoring (payments, totals, violations, errors from on-chain
  events) · in-app feedback (Supabase, insert-only RLS) · on-chain activity logging
  (proof-of-usage backbone)

## [0.2.0] — 2026-06-18 → 06-23 · Confidential ZK + open-economy trust layer

Built during Stellar Hacks: Real-World ZK; submitted to DoraHacks.

- **Added (ZK)** — Circom/BN254 compliance circuit (per-task range + daily-sum bounds +
  Poseidon commitments + Merkle whitelist membership) · Groth16 trusted setup (Hermez ptau) ·
  **on-chain BN254 verifier** with anchored-policy binding + replay guard, live on testnet
  with a replay-rejected proof · CSPRNG commitment salts
- **Added (trust)** — reputation-gated payees (whitelist OR earned ERC-8004-style trust) ·
  outcome-bound escrow (lock → release / refund) · bounded x402 buyer (policy gate before
  settle, live on-chain settle) · Treasury v2 on testnet
- **Added (app)** — multi-wallet support via StellarWalletsKit · real-time on-chain event
  feed · Vitest suites + 3-job CI (contracts / web / packages)

## [0.1.0] — 2026-06-03 · Bounded agent treasury (IBW 2026)

🏆 2nd place, AGENTIC category — Stellar Build On Hackathon (IBW 2026, Istanbul).

- **Added** — Soroban bounded treasury: payee whitelist · per-task limit · daily limit,
  enforced on-chain with per-task accounting (checks-effects-interactions, atomic
  constructor init) · autonomous-agent demo dashboard (prompt-injection rejected on-chain) ·
  muxed-account funding rail (zero-cost sub-address attribution) · spectral landing + pitch
  deck · build-time guard refusing the demo key off-testnet

[0.3.1]: https://github.com/Bekirerdem/prism/commits/main
[0.3.0]: https://github.com/Bekirerdem/prism/commits/main
[0.2.0]: https://github.com/Bekirerdem/prism/commits/main
[0.1.0]: https://github.com/Bekirerdem/prism/commits/main
