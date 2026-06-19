# Prism — Testnet Deployment

Network: **Stellar Testnet** (`Test SDF Network ; September 2015`)

## Identities

| Alias | Address | Role |
|-------|---------|------|
| alice | `GDPKXL6CNHUXBV4PM54CPTRZNQRYVTIMO4YGBW3M2MNSCMQ7TTNINXP6` | Admin + USDC issuer |
| agent | `GDAOXABLEOFZP2M4PRM7N6YKOKXWMPFOSLU35WL5ZQY4PQFHF3VCIDS6` | The bounded AI agent (signs `pay`) |
| service | `GDOMW4C36BUBBFJW3V4L22LUICOUKFVTPGOYU6UMZZ6D3ENEOCH4QCRT` | Whitelisted payee (has USDC trustline) |

## Contracts

| Contract | Address |
|----------|---------|
| USDC (SAC, issuer=alice) | `CDCEHPK4OJXVRA4JV7N56GR5SRD5KGGZ55BDSHKODGR72Y4KGS6A3Y2W` |
| **Prism Treasury** | `CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ` |
| Treasury wasm hash | `41c8bb1f0b4d9bd7b89c3a855ee87cb56971a256fe110cd2860d406dde040c2b` |
| **Compliance Verifier (ZK)** | `CA3A7AOGF5WHJ7CHFARBQ5W7G7VQ46KLXTCGIC7XBTYSGEESUIOSWS5B` |

## Policy (constructor)

- `daily_limit`  = `500000000`  (50 USDC, 7 decimals)
- `per_task_limit` = `100000000` (10 USDC)

## Verified on-chain (USDC has 7 decimals → 1 USDC = 10_000_000)

| Action | Result |
|--------|--------|
| Fund treasury (mint 500 USDC) | balance = `5000000000` ✅ |
| `is_payee(service)` | `true` ✅ |
| `is_payee(attacker)` | `false` ✅ |
| **Rogue pay → non-whitelisted** | `Error(Contract, #2)` PayeeNotWhitelisted ✅ rejected on-chain |

Full policy (legit pay + per-task `#3` / daily-limit `#4` rejection + per-task accounting +
day-rollover reset) is proven by the contract test suite — `cargo test` → **6/6 passing** —
and exercised live in the dashboard demo. The treasury starts each demo clean at 500 USDC.

## Confidential compliance layer (ZK)

A Groth16 (BN254) proof, verified **on-chain** by the Compliance Verifier contract, attests that a
batch of agent payments obeyed policy — each ≤ per-task limit, Σ ≤ daily limit, every payee ∈ a
committed whitelist — **without revealing any amount or payee**. Payments are committed as
`Poseidon(amount, payee, salt)`; only the commitments + the proof go on-chain.

| Item | Value |
|------|-------|
| Compliance Verifier | `CA3A7AOGF5WHJ7CHFARBQ5W7G7VQ46KLXTCGIC7XBTYSGEESUIOSWS5B` |
| Verifier wasm hash | `50b84c76d791106f68ccf88a41a753e962d635dc0ad3db5c003c2da741849844` |
| **On-chain verify tx** | [`2019dd79…56c9b1`](https://stellar.expert/explorer/testnet/tx/2019dd7956521d7e0a1942e4f7723825c583d3b90783972c7b920f33cc56c9b1) → emitted `ComplianceAttested` |

Verified statement (public signals `[dailyLimit, perTaskLimit, whitelistRoot, periodId, commitments[8]]`).
The verify call emitted `attested = { whitelist_root, period_id }` on-chain. Circuit witness tests
(`npm test` in `circuits/`) → **5/5**; contract tests (`cargo test -p compliance_verifier`) → **2/2**.

**Honesty note.** The ZK layer hides Prism's *compliance ledger* — Prism's storage and events carry
only commitments and a proof, never plaintext amounts or payees. If confidential mode also moves real
USDC via SAC transfers to revealed payees at settlement, those transfers stay visible at the
**token-contract layer**; transfer-level privacy is the shielded-pool roadmap. For the demo, real fund
movement is shown in the contrasting transparent treasury ("public mode"), while confidential mode
focuses on commitments + the on-chain-verified compliance proof.

**Toolchain:** Circom + snarkjs (Groth16 / BN254), public Hermez powers-of-tau; on-chain verifier
generated with `soroban-verifier-gen --curve bn254`, verified via Soroban's `bn254_multi_pairing_check`.

## Error codes

`1` InvalidAmount · `2` PayeeNotWhitelisted · `3` ExceedsTaskLimit · `4` ExceedsDailyLimit

## Funding rail — muxed attribution

Pool account (classic G): `GD2NZKSMQW367OIFXRM4NP7RIW6YLDZLJ4C7253MDOKCFC4Q4IOO3427`

Each agent budget is a **zero-cost muxed (M...) sub-address** of the pool, derived by id
(1 = Research, 2 = Marketing, 3 = Ops). A client pays the M-address; Horizon attributes the
deposit via `to_muxed_id` — no memos, no new accounts. Verified live (5 XLM → budget #1,
tx `a13fdb5b…`). Funder in the demo = the `agent` key (stands in for a client wallet).

## ERC-8004 (trionlabs/stellar-8004) — testnet registries to integrate

| Registry | Testnet address |
|----------|-----------------|
| Identity | `CDE3K4COIAGWNNJQQLL26SYI3KBJF5FUDHXG5FA6GYDJCG7T5V7FIWZH` |
| Reputation | `CBZEAGIEI3HXMDRLF44KLQJQQOH6LCYWWSGJVSYQYQO2HQ6DDGZ7HT55` |
| Validation | `CC5USZRO26MOIAVNYTTJDS63C2OBBLREOAOET4CPF2EZWO3YFKLMO3SL` |

SDK: `@trionlabs/8004-sdk` · Agent id format: `stellar:testnet:{identityRegistry}#{agentId}`
