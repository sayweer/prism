import { test } from "node:test";
import assert from "node:assert/strict";
import { gateX402 } from "./gate.js";
import { boundedPay } from "./index.js";
import type { PaymentRequirements, TreasuryPolicy } from "./types.js";

const TOKEN = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"; // testnet USDC

function req(over: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: "exact",
    network: "stellar-testnet",
    maxAmountRequired: "50000000", // 5 USDC
    asset: TOKEN,
    payTo: "GVENDOR",
    resource: "https://api.example.com/data",
    ...over,
  };
}

function policy(over: Partial<TreasuryPolicy> = {}): TreasuryPolicy {
  return {
    perTaskLimit: 100000000n, // 10 USDC
    dailyLimit: 200000000n, // 20 USDC
    daySpent: 0n,
    token: TOKEN,
    isAllowedPayee: (p) => p === "GVENDOR",
    ...over,
  };
}

test("allows a payment within policy to an allowed payee", () => {
  const r = gateX402(req(), policy());
  assert.equal(r.allowed, true);
  assert.equal(r.amount, 50000000n);
});

test("denies over the per-task limit", () => {
  const r = gateX402(req({ maxAmountRequired: "150000000" }), policy());
  assert.equal(r.allowed, false);
  assert.match(r.reason!, /per-task/);
});

test("denies when the daily limit would be exceeded", () => {
  const r = gateX402(req(), policy({ daySpent: 180000000n })); // 18 + 5 > 20
  assert.equal(r.allowed, false);
  assert.match(r.reason!, /daily/);
});

test("denies a payee that is neither whitelisted nor reputable", () => {
  const r = gateX402(req({ payTo: "GATTACKER" }), policy());
  assert.equal(r.allowed, false);
  assert.match(r.reason!, /payee/);
});

test("denies an asset mismatch", () => {
  const r = gateX402(req({ asset: "GSOMEOTHER" }), policy());
  assert.equal(r.allowed, false);
  assert.match(r.reason!, /asset/);
});

test("boundedPay settles only when allowed", async () => {
  let settled = 0;
  const settle = async () => {
    settled++;
    return "txhash123";
  };

  const ok = await boundedPay(req(), policy(), settle);
  assert.equal(ok.txHash, "txhash123");
  assert.equal(settled, 1);

  const denied = await boundedPay(req({ maxAmountRequired: "150000000" }), policy(), settle);
  assert.equal(denied.txHash, undefined);
  assert.equal(settled, 1); // settle NOT called again
});
