# Security

PRISM is **testnet-only** today. Do not use it with real funds. The path to mainnet is
security-gated — see [`ROADMAP.md`](ROADMAP.md) (M2/M3) for what must land first.

## Security model

- **Non-custodial.** Funds live in the owner's own Soroban contract. PRISM code cannot move
  value outside the on-chain policy (payee whitelist / reputation gate · per-task limit ·
  daily limit). Policy violations are rejected **by the contract**, on-chain.
- **Checks-effects-interactions.** Accounting is written before the token transfer; a failed
  or re-entrant transfer reverts the whole call atomically. Soroban additionally forbids
  host-level reentrancy.
- **No front-runnable initialization.** Policy is set atomically in the constructor at
  deploy time — there is no separate `initialize` to race.
- **Overflow-checked arithmetic.** `overflow-checks = true` in the workspace release profile;
  spend accounting panics (reverts) rather than wrapping.
- **Testnet-only demo key.** The spectator demo embeds a worthless testnet agent key on
  purpose (the contract, not a human click, is the safety). A build-time guard refuses to
  load it on any non-testnet network. The per-user product embeds no keys — every action is
  signed by the user's own wallet.
- **Hardened ZK verifier.** The on-chain Groth16/BN254 compliance verifier binds proofs to
  the owner's anchored policy and enforces a per-period replay guard (both covered by tests,
  including a live replay-rejected transaction on testnet).

## Audit history

An internal security audit (agent-assisted, CSO-style: contract + frontend + dependency/
supply-chain review) was performed on **2026-06-03**, before the ZK layer and the per-user
product shipped. No critical findings. Status of every finding:

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| F1 | High | Embedded demo agent key had no mainnet guard | ✅ Fixed — build-time network guard refuses non-testnet |
| C1 | Medium | CEI ordering in `pay()` (transfer before accounting) | ✅ Fixed — effects recorded before transfer |
| C2 | Medium | Daily limit resets on the UTC **calendar day**, not a rolling 24h window — up to 2× the limit can be spent across a day boundary | ⚠️ Open — documented here; rolling window is roadmap M2 |
| C6 | Info | Narrow test coverage (single test) | ✅ Fixed — 14 contract tests (core + reputation + escrow) + 4 verifier tests + circuit & web suites, all in CI |
| F3 | Medium | Missing client-side input validation (latent) | ✅ Largely fixed — contract-id checksum validation, amount guards; the contract remains the real gate |
| C4 | Info | No admin withdraw/sweep — funds can strand if the agent key is lost or the whitelist is empty | ⚠️ Open by design today; admin withdraw + lifecycle controls are roadmap M2 |
| C3 | Low | No storage TTL management (`extend_ttl`) — long-idle entries can be archived | ⚠️ Open — roadmap M3 (mainnet hardening) |
| C5 | Info | No constructor bounds on limits (e.g. per-task > daily) | ⚠️ Open — low risk (owner configures own treasury) |
| F4 | Low | No CSP / security headers on the static site | ⚠️ Open — testnet demo scope |
| — | Info | npm audit 0 CVEs · pinned lockfile · no postinstall scripts · clean git history | ✅ Verified at audit time |

## Known limitations (honest scope)

- **Contracts are immutable.** There is no pause, agent-key rotation, limit update, or
  upgrade path yet. That is acceptable for a testnet product and unacceptable for mainnet —
  it is the core of roadmap **M2**.
- **Per-user treasuries set `agent = admin` (your wallet).** Autonomous agent signing with a
  separate, bounded agent credential (session keys) is designed but not yet shipped (M2).
- **The ZK layer attests after the fact.** `pay()` does not require a proof; confidential
  compliance and the payment flow are not yet wired together (M4). The Groth16 setup is a
  single-party dev setup — a multi-party ceremony is a mainnet prerequisite (M3).
- **The reputation oracle is a stand-in.** Scores are admin-set on testnet; production
  targets the [trionlabs/stellar-8004](https://github.com/trionlabs/stellar-8004) registries (M4).

## Reporting a vulnerability

- Preferred: **GitHub private vulnerability reporting** on this repository
  (Security → Report a vulnerability).
- Or email **l3ekirerdem@gmail.com** with details and reproduction steps.

There is no bug bounty yet. Reports are acknowledged as fast as possible and fixes are
prioritized ahead of feature work. Please do not open public issues for exploitable
vulnerabilities before a fix ships.
