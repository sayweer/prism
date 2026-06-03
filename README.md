<div align="center">

# ◭ Prism

### The wallet your AI agent can't drain.

A non-custodial Soroban treasury that lets a business hand an autonomous AI agent **real money to spend** — where the **contract**, not the model's good behaviour, enforces the limits. Every payment is auto-accounted, and Stellar settles in sub-cents.

![Build on Stellar](https://img.shields.io/badge/Build_on_Stellar-IBW_2026-7C3AED?style=flat-square)
![Network](https://img.shields.io/badge/network-Stellar_testnet-22D3EE?style=flat-square)
![Contract](https://img.shields.io/badge/contract-Rust_·_Soroban-E06C2B?style=flat-square)
![Tests](https://img.shields.io/badge/tests-6%2F6_passing-00FF43?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-A0A0B8?style=flat-square)

**[▶ Live demo](https://web-five-psi-7iqrhfurdh.vercel.app) · [🎤 Pitch deck](https://deck-bice-omega.vercel.app) · [🔗 Contract on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ) · [📄 Deployment & proofs](DEPLOYMENT.md)**

<img src="docs/hero.png" alt="Prism — the wallet your AI agent can't drain" width="840" />

</div>

---

## TL;DR

- **Bound** — the agent physically can't overspend or pay the wrong address; the contract rejects violations **on-chain**.
- **Account** — every payment is tracked per task in the contract, attributable with zero overhead.
- **Fund** — earmark a budget per agent via zero-cost Stellar **muxed sub-addresses** — no memos, no new accounts.
- **Live** — deployed on Stellar testnet, paying real USDC and rejecting real exploits. `cargo test` → **6/6**.

## The problem

AI agents can reason, plan, and act — right up until they need to **pay** for something. Today no business gives an LLM agent a wallet, for two reasons:

1. **Safety.** One hallucination, jailbreak, or prompt-injection and the wallet is drained.
2. **Accounting.** An agent that makes hundreds of small payments is impossible to reconcile.

So agents "research and recommend" but never actually transact. **Prism removes the blocker.**

## What Prism does

| | Guarantee | How |
|---|---|---|
| **Bound** | The agent can't overspend or pay the wrong address | Soroban contract enforces a policy (payee whitelist · per-task limit · daily limit) and **rejects violations on-chain** |
| **Account** | Every payment is attributable, with zero overhead | Spend is tracked **per task** in the contract; read straight off-chain |
| **Fund** | Earmark money for a specific agent budget with no memos | A pool account issues **zero-cost muxed sub-addresses**; deposits are attributed by `to_muxed_id` |

The business keeps custody the whole time — funds live in the owner's own Soroban contract. Prism is the **guardrails + accounting + rail**, never the custodian.

## How it works

The agent signs its own `pay(task, to, amount)`. The contract runs the policy gate, in order, on **every** call:

```
1. agent.require_auth()              only the registered agent can spend
2. amount > 0                        else  InvalidAmount        (#1)
3. payee is whitelisted              else  PayeeNotWhitelisted  (#2)
4. amount ≤ per-task limit           else  ExceedsTaskLimit     (#3)
5. day_spent + amount ≤ daily limit  else  ExceedsDailyLimit    (#4)
6. record spend, THEN transfer       (checks-effects-interactions — reverts atomically)
```

A prompt-injected "drain to attacker" payment is signed by the agent and still **bounces** at step 3 — funds never move.

```
          fund (muxed M-addr, per budget)            agent pays vendor (USDC)
   client ───────────────► POOL (G) ──► owner    AGENT ──► [ pay(task,to,amt) ]
                            to_muxed_id            (signs)         │
                            attribution                            ▼
                                                  ┌──────────────────────────────┐
                                                  │  PRISM TREASURY (Soroban)     │
                                                  │  • policy: whitelist / per-   │
                                                  │    task / daily limit         │
                                                  │  • rejects violations on-chain│
                                                  │  • per-task accounting + event│
                                                  │  USDC stays here (owner's)    │
                                                  └──────────────┬───────────────┘
                                                                 ▼  USDC transfer
                                                              VENDOR
   trust layer:  ERC-8004 identity on-chain · reputation = next step  ·  trionlabs/stellar-8004
```

## Why Stellar

- **Sub-cent, deterministic fees** make agent micro-payments economical (gas would kill this).
- **Muxed accounts** — one account, infinite zero-cost sub-addresses — are the attribution primitive for swarms of agent payments. No equivalent is this cheap elsewhere.
- **Native account abstraction** (`__check_auth`) makes a contract-bounded agent first-class.
- **Native USDC** + path-payment + anchors connect the agent to the real world.

## Try the live demo

**→ [web-five-psi-7iqrhfurdh.vercel.app](https://web-five-psi-7iqrhfurdh.vercel.app)** (Stellar testnet, no wallet needed)

1. **Run agent tasks** — the agent autonomously settles 3 vendor payments in USDC. No wallet popup; it signs its own transactions. Each lands with a real Stellar Expert tx link.
2. **Simulate prompt-injection** — tell the agent to send funds to an unapproved wallet. The contract **rejects it on-chain** (`PayeeNotWhitelisted`). Funds never move. 🔴
3. **Auto-reconciled spend** — per-task accounting, read straight from the contract.
4. **Funding rail** — fund a budget via its zero-cost muxed sub-address; the deposit is attributed on-chain with no memo.

## Live on testnet

| Contract | Address |
|---|---|
| Prism Treasury | [`CAYWNXHA…SPAZ`](https://stellar.expert/explorer/testnet/contract/CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ) |
| USDC (SAC) | [`CDCEHPK4…3Y2W`](https://stellar.expert/explorer/testnet/contract/CDCEHPK4OJXVRA4JV7N56GR5SRD5KGGZ55BDSHKODGR72Y4KGS6A3Y2W) |
| Funding pool | [`GD2NZKSM…3427`](https://stellar.expert/explorer/testnet/contract/GD2NZKSMQW367OIFXRM4NP7RIW6YLDZLJ4C7253MDOKCFC4Q4IOO3427) |
| ERC-8004 Identity Registry | [`CDE3K4CO…FIWZH`](https://stellar.expert/explorer/testnet/contract/CDE3K4COIAGWNNJQQLL26SYI3KBJF5FUDHXG5FA6GYDJCG7T5V7FIWZH) — agent #1 registered |

Full addresses + verified on-chain results: [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Quickstart

```bash
# 1. Contract — test & build (already deployed; this is optional)
cargo test  --manifest-path contracts/treasury/Cargo.toml   # 6/6 passing
stellar contract build --manifest-path contracts/treasury/Cargo.toml

# 2. Frontend — landing + live dashboard
cd web
npm install
npm run dev        # opens on http://localhost:5173 (or the next free port)
```

The dashboard reads live testnet state, and the embedded agent key (testnet-only, zero value) lets the agent sign its own payments — that's the whole point: **the contract is the safety, not a human clicking approve.** A build-time guard refuses to load the bundled key on any non-testnet network.

## Project structure

```
contracts/treasury/        Soroban bounded-treasury contract (+ 6 tests)
packages/treasury-client/  generated TypeScript client
web/                       landing + live dashboard (Vite · React 19 · TS)
deck/                      pitch deck (self-contained spectral slides)
DEPLOYMENT.md              live testnet addresses & verified results
docs/                      narrative + assets
```

## Tech stack

- **Contract:** Rust / `soroban-sdk` 26 (Soroban, Stellar testnet)
- **Client:** `stellar contract bindings typescript` → typed client
- **Frontend:** Vite + React 19 + TypeScript, framer-motion, OKLCH spectral design system
- **Trust:** ERC-8004 agent identity registered on-chain ([trionlabs/stellar-8004](https://stellar.expert/explorer/testnet/contract/CDE3K4COIAGWNNJQQLL26SYI3KBJF5FUDHXG5FA6GYDJCG7T5V7FIWZH) registries) — agent #1, verified in the dashboard. Reputation-gated payees are the documented next step.

## Security

- **Non-custodial** — USDC never leaves the owner's own contract; Prism cannot move funds outside the policy.
- **Checks-effects-interactions** — accounting is written before the transfer, so a failed/reentrant transfer reverts the whole call atomically.
- **No front-runnable init** — the policy is set atomically in the constructor at deploy time.
- **Testnet-only key** — the demo's embedded agent key holds no real value, and a config guard blocks loading it on any non-testnet network.

## Team

- **Bekir Erdem** — contract & engine (the Soroban treasury and core).
- **Seyit Ali Değirmen** — money system & the screen (muxed funding rail + UX).

## License

[MIT](LICENSE) © 2026 Bekir Erdem · Seyit Ali Değirmen
