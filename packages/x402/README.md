# prism-x402 — bounded x402 buyer

The safe wallet behind an agent's [x402](https://developers.stellar.org/docs/build/agentic-payments/x402) payments on Stellar.

When a service replies `402 Payment Required`, an agent normally signs a payment for
whatever the server asks. **prism-x402 gates that payment against the treasury policy
first** — per-task limit, daily limit, and the payee whitelist OR reputation gate — and
only settles through the bounded treasury if it passes. An over-limit or wrong-payee
x402 request never reaches settlement.

```ts
import { boundedPay } from "prism-x402";

const result = await boundedPay(requirements, policy, settle);
//  requirements: parsed from the server's 402 response
//  policy:       a snapshot of the treasury's limits + payee gate
//  settle:       invokes the v2 treasury's pay() (the on-chain enforcement)
if (!result.gate.allowed) console.log("refused:", result.gate.reason);
else console.log("paid, tx:", result.txHash);
```

`gateX402` mirrors the on-chain gate so the agent never attempts a payment the contract
would reject; `treasury.pay` is the final, on-chain word.

## Production integration (the seam)

- **Protocol/client:** the [`x402-stellar`](https://www.npmjs.com/package/x402-stellar) package (Soroban **auth-entry signing** — the Stellar x402 scheme).
- **Facilitator (testnet):** OpenZeppelin Relayer plugin at `https://channels.openzeppelin.com/x402/testnet` (`/verify`, `/settle`, `/supported`), sponsored fees.
- **Asset:** testnet USDC (SEP-41) `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`.
- **Settlement:** `settle` signs the agent's Soroban auth-entry for the v2 treasury's `pay()` so the bounded contract enforces policy at settlement time.

This package ships the Prism-specific value — the **bounded gate** + treasury-routed
settlement — tested in isolation. The HTTP 402 handshake + auth-entry signing use the
`x402-stellar` client at the documented seam (`settle`).
