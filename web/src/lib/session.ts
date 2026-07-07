// Agent session keys — a browser-local, time-bound, spend-capped credential the
// treasury recognises as its ONLY spender while active. This is what makes the
// per-user product's agent autonomous: after one wallet-signed set_session, the
// session keypair signs payments with no wallet popups (same pattern as the demo
// agent in prism.ts).
//
// ⚠️ The session SECRET lives in localStorage — acceptable on TESTNET precisely
// because the design's point is a bounded credential: cap + expiry + instant
// revoke make a leak survivable. Mainnet needs fee sponsorship + hardened key
// storage (roadmap M3); the demo key's non-testnet build guard applies there too.
import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { NETWORK_PASSPHRASE } from "../config";
import { fundWithFriendbot } from "./funding";
import type { Client, Session } from "./treasuryClient";
import { makeTreasury, pay, setSession, type PayResult } from "./userTreasury";
import type { ContractSigner } from "./walletSigner";

const PREFIX = "prism_session:";

export function loadSessionSecret(treasuryId: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(PREFIX + treasuryId);
}

export function saveSessionSecret(treasuryId: string, secret: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PREFIX + treasuryId, secret);
}

export function clearSessionSecret(treasuryId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PREFIX + treasuryId);
}

/** Whether a stored session is still active (the contract uses the same `<` rule). */
export function sessionIsActive(
  session: Pick<Session, "valid_until"> | null,
  nowMs: number = Date.now(),
): boolean {
  return session !== null && nowMs / 1000 < Number(session.valid_until);
}

/** The session keypair as a contract-client signer (no popups — it signs locally).
 *  Wrapped so the optional signerAddress from basicNodeSigner becomes concrete. */
export function sessionSigner(secret: string): { publicKey: string; signer: ContractSigner } {
  const kp = Keypair.fromSecret(secret);
  const s = basicNodeSigner(kp, NETWORK_PASSPHRASE);
  const publicKey = kp.publicKey();
  return {
    publicKey,
    signer: {
      signTransaction: async (xdr, opts) => {
        const res = await s.signTransaction(xdr, opts);
        return { signedTxXdr: res.signedTxXdr, signerAddress: res.signerAddress ?? publicKey };
      },
    },
  };
}

/** Start an agent session: generate a fresh keypair, friendbot-fund it (it is the
 *  tx source for autonomous payments, so it must exist and pay its own fees), then
 *  register it with the wallet-signed `set_session`. The secret is stored only
 *  after the on-chain registration succeeds. */
export async function createSession(
  walletTreasury: Client,
  treasuryId: string,
  capXlm: number,
  durationHours: number,
): Promise<PayResult & { sessionPk?: string }> {
  const kp = Keypair.random();
  await fundWithFriendbot(kp.publicKey()); // fresh key → the account never pre-exists
  const validUntil = BigInt(Math.floor(Date.now() / 1000) + Math.round(durationHours * 3600));
  const res = await setSession(walletTreasury, kp.publicKey(), validUntil, capXlm);
  if (res.ok) {
    saveSessionSecret(treasuryId, kp.secret());
    return { ...res, sessionPk: kp.publicKey() };
  }
  return res;
}

/** A zero-popup payment signed by the session key — the autonomous-agent path. */
export async function sessionPay(
  treasuryId: string,
  secret: string,
  taskId: bigint,
  to: string,
  amountXlm: number,
): Promise<PayResult> {
  const { publicKey, signer } = sessionSigner(secret);
  const t = makeTreasury(treasuryId, publicKey, signer);
  return pay(t, taskId, to, amountXlm);
}
