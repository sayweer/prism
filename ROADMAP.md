# PRISM Roadmap

PRISM is moving from a proven testnet product to **mainnet agent-payments infrastructure on Stellar**. Milestones are sequenced, not dated — each one unlocks the next, and each is verifiable on-chain or in the repo.

## M1 — Traction on testnet *(current)*

- [x] Bounded treasury live on testnet — payee whitelist + per-task & daily limits enforced on-chain
- [x] Per-user product: connect a wallet → deploy your own treasury → fund → whitelist → spend
- [x] ZK compliance layer — Circom/Groth16 proofs, hardened on-chain BN254 verifier (policy binding + replay guard)
- [x] Analytics & monitoring + in-app feedback + on-chain activity logging (proof of usage)
- [ ] 10+ real user wallets with on-chain interactions (risein Journey-to-Mastery Level 4) — distribution in progress
- [ ] Published user-feedback summary

## M2 — Agent infrastructure

Closing the gap between "a human signs every payment" and "an agent spends autonomously, safely":

- [ ] **Session-key agent signing** — time-bound, spend-capped agent credentials per user treasury (`agent ≠ admin`), instant revocation
- [ ] **Contract lifecycle** — pause/freeze switch, agent-key rotation, admin withdraw, limit updates (today the contract is immutable by design; real users need an exit)
- [ ] **On-chain treasury registry** — discovery & recovery by owner wallet (no client-side-only state)
- [ ] **Rolling daily-limit window** — close the fixed-UTC-day 2× boundary spend

## M3 — Mainnet

- [ ] Circle **USDC** integration — real dollars replace test-minted assets
- [ ] Security hardening pass + external review / audit path
- [ ] Multi-party **trusted-setup ceremony** for the ZK circuit (replacing the single-party dev setup)
- [ ] Mainnet deployment with conservative default policies

## M4 — Ecosystem integrations

- [ ] Production **ERC-8004 reputation** ([trionlabs/stellar-8004](https://github.com/trionlabs/stellar-8004)) — earned reputation replaces the testnet stand-in oracle
- [ ] **OpenClaw / ClawHub skill** — agents create and manage their PRISM treasury conversationally
- [ ] **x402 productization** — bounded pay-per-use spending for agent-facing APIs
- [ ] ZK compliance wired into the payment flow (confidential-by-default option), composing with OpenZeppelin Confidential Tokens via `ComplianceHooks`

## M5 — Growth & sustainability

- [ ] 50+ active user wallets (risein Level 5-7 targets)
- [ ] Revenue model validated with real users (candidates: fee on treasury operations, premium policy features) — decided by usage data, not assumption
- [ ] Ecosystem partnerships formalized (Stellar Türkiye, Trion Labs, agent-platform integrations)

---

**Where we are:** M1 nearly complete — the product is live at [prism-stellar.vercel.app](https://prism-stellar.vercel.app) with real testnet users. M2 is specced (session keys, lifecycle) and is the immediate next build. Progress is tracked in the commit history and [`DEPLOYMENT.md`](DEPLOYMENT.md).
