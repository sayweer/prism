# PRISM Web

The web app for [PRISM](../README.md): cinematic landing, the autonomous-agent demo
dashboard, and the per-user workspace (connect a wallet → deploy your own bounded
treasury). Vite · React 19 · TypeScript · framer-motion · `@stellar/stellar-sdk` +
StellarWalletsKit.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
```

## Test · build · lint

```bash
npm test           # Vitest — pure-lib suites (wallet errors, events, funding, treasury ops…)
npm run build      # tsc -b && vite build
npm run lint       # eslint (known legacy debt in generated treasuryClient.ts)
```

## Environment

Optional — the app runs without them, but feedback + activity logging silently no-op:

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…   # publishable key; RLS is insert-only (see ../supabase/migrations)
```

Copy `.env.example` to `.env`. Beware invisible non-ASCII bytes when pasting keys —
`src/lib/supabase.ts` strips them for a reason.

## Deploy

Vercel, manual (no auto-deploy on push):

```bash
vercel --prod      # aliases prism-stellar.vercel.app
```

Env vars must be set in the Vercel dashboard for Production.

## Layout

```
src/components/   Landing · Dashboard (demo) · Workspace (per-user) · Wallet · ActivityFeed · AppNav/WalletChip
src/lib/          userTreasury (deploy/fund/pay) · walletKit/walletSigner · funding (friendbot)
                  events/analytics (on-chain reads) · feedback/activity (Supabase) · wallet-errors
src/config.ts     testnet contract ids + demo config (build-time non-testnet guard)
```
