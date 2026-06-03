# Prism

**The wallet your AI agent can't drain.** A non-custodial treasury that lets a business
hand an autonomous agent real money to spend — where the *contract*, not the model's good
behaviour, enforces the limits, every payment is auto-accounted, and Stellar settles in
sub-cents.

> Built for **Build On Stellar — IBW 2026** (Main + Hack Agentic). Live on testnet.

---

## The problem

AI agents can reason, plan, and act — right up until they need to **pay** for something.
Today no business gives an LLM agent a wallet, for two reasons:

1. **Safety.** One hallucination, jailbreak, or prompt-injection and the wallet is drained.
2. **Accounting.** An agent that makes hundreds of small payments is impossible to reconcile.

So agents "research and recommend" but never actually transact. Prism removes the blocker.

## What Prism does

| | Guarantee | How |
|---|---|---|
| **Bound** | The agent physically can't overspend or pay the wrong address | Soroban contract enforces a policy (payee whitelist · per-task limit · daily limit) and **rejects violations on-chain** |
| **Account** | Every payment is attributable, with zero overhead | Spend is tracked **per task** in the contract; read straight off-chain |
| **Fund** | Earmark money for a specific agent budget with no memos | A pool account issues **zero-cost muxed sub-addresses**; deposits are attributed by `to_muxed_id` |

The business keeps custody the whole time — funds live in the owner's own Soroban contract.
Prism is the **intelligence + guardrails + rail**, never the money layer.

## Why Stellar (the real answer)

- **Sub-cent, deterministic fees** make agent micro-payments economical (gas would kill this).
- **Muxed accounts** — one account, infinite zero-cost sub-addresses — are the attribution
  primitive for swarms of agent payments. No equivalent is this cheap elsewhere.
- **Native account abstraction** (`__check_auth`) makes a contract-bounded agent first-class.
- **Native USDC** + path-payment + anchors connect the agent to the real world.

## Live on testnet

| Contract | Address |
|---|---|
| Prism Treasury | [`CAYWNXHA…SPAZ`](https://stellar.expert/explorer/testnet/contract/CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ) |
| USDC (SAC) | [`CDCEHPK4…3Y2W`](https://stellar.expert/explorer/testnet/contract/CDCEHPK4OJXVRA4JV7N56GR5SRD5KGGZ55BDSHKODGR72Y4KGS6A3Y2W) |
| Funding pool | [`GD2NZKSM…3427`](https://stellar.expert/explorer/testnet/contract/GD2NZKSMQW367OIFXRM4NP7RIW6YLDZLJ4C7253MDOKCFC4Q4IOO3427) |
| ERC-8004 Identity Registry | [`CDE3K4CO…FIWZH`](https://stellar.expert/explorer/testnet/contract/CDE3K4COIAGWNNJQQLL26SYI3KBJF5FUDHXG5FA6GYDJCG7T5V7FIWZH) (agent #1) |

Full details + verified results: [`DEPLOYMENT.md`](DEPLOYMENT.md).

## The demo (what to watch)

1. **Run agent tasks** — the agent autonomously settles 3 vendor payments in USDC. No wallet
   popup; it signs its own transactions. Each lands with a real Stellar Expert tx link.
2. **Simulate prompt-injection** — the agent is told to send funds to an unapproved wallet.
   The contract **rejects it on-chain** (`PayeeNotWhitelisted`). Funds never move. 🔴
3. **Auto-reconciled spend** — per-task accounting, read straight from the contract.
4. **Funding rail** — fund a specific agent budget via its zero-cost muxed sub-address; the
   deposit is attributed on-chain with no memo.

## Architecture

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

## Run it

```bash
# contract (already deployed; rebuild/test optional)
cargo test --manifest-path contracts/treasury/Cargo.toml
stellar contract build --manifest-path contracts/treasury/Cargo.toml

# frontend
cd web
npm install
npm run dev        # http://localhost:5173
```

The dashboard reads live testnet state and the embedded agent key (testnet-only, no value)
lets the agent sign its own payments — that's the point: the contract is the safety, not a
human clicking approve.

## Tech

- **Contract:** Rust / `soroban-sdk` 26, Soroban testnet
- **Client:** `stellar contract bindings typescript` → typed client
- **Frontend:** Vite + React 19 + TypeScript, framer-motion, OKLCH spectral design system
- **Trust:** ERC-8004 agent identity registered on-chain (trionlabs/stellar-8004 registries) — agent #1, verified in the dashboard. Reputation-gated payees are the documented next step.

## Structure

```
contracts/treasury/        Soroban bounded-treasury contract (+ tests)
packages/treasury-client/  generated TypeScript client
web/                       cinematic landing + live dashboard
DEPLOYMENT.md              live testnet addresses & verified results
```

## Team

Bekir Erdem (contract + infra) · Seyit Ali Değirmen (muxed funding rail + UX).
