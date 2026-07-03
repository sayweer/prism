# Try Prism — a 5-Minute Guide (Testnet)

*Türkçe versiyon: [TRY-IT-TR.md](TRY-IT-TR.md)*

**What is Prism?** A bounded treasury on Stellar that lets you hand an AI agent real
spending power, safely: the daily limit, per-payment limit, and payee whitelist are
enforced by the **contract** — no matter how hard the model is "persuaded", funds can't
leave the policy.

Everything below runs on **testnet**: no real money, zero risk. Every action is signed
by your own wallet — non-custodial, funds stay under your control the whole time.

**App:** [prism-stellar.vercel.app](https://prism-stellar.vercel.app) → **Open app** (top right)

## Steps

1. **Install a wallet** — add the [Freighter](https://www.freighter.app/) browser
   extension and switch it to **Testnet** in its settings. (Already have a Stellar
   wallet? Skip this step.)
2. **Connect** — *Open app* → *Connect a wallet* → pick Freighter.
3. **Get free testnet XLM** — if your wallet is empty, the app detects it and shows a
   **"Get free testnet XLM"** button; one click funds you via friendbot.
4. **Create your treasury** — set your daily and per-payment limits → *Create treasury* →
   sign in your wallet. When the deploy finishes, **hit "Copy ID" and save your treasury
   ID** — it's how you reopen the same treasury from another browser or device.
5. **Fund it** — enter an amount (e.g. 20) → *Fund* → sign.
6. **Whitelist a payee** — add an address that may be paid. No second address handy?
   Click **"use the sample vendor"** under the input.
7. **Spend** — send an in-policy payment to your whitelisted address → it settles
   on-chain ✓.
8. **Now watch the real show** — try an amount **over** your limit, or a payment to an
   address you never whitelisted: the contract **rejects it on-chain** and funds never
   move. That rejection is the product working. 🔴

## If something goes wrong

- Errors are shown in plain language inside the app (insufficient balance, signature
  rejected, and so on).
- Two sentences via the **Share feedback** button (bottom right) directly shape the
  roadmap. 🙏

## More

- Main [README](../README.md) — architecture, contracts, the ZK confidential mode
- Spectator demo (no wallet needed): **Launch live demo** on the landing page
