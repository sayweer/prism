// Thin app-facing layer over the generated treasury client.
// Reads state via simulation and lets the autonomous agent sign + send payments.

import { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";
import { Client, Errors } from "./treasuryClient";
import {
  AGENT_PK,
  AGENT_SECRET,
  NETWORK_PASSPHRASE,
  RPC_URL,
  TREASURY_ID,
} from "../config";

const agentKp = Keypair.fromSecret(AGENT_SECRET);
const signer = basicNodeSigner(agentKp, NETWORK_PASSPHRASE);

const treasury = new Client({
  contractId: TREASURY_ID,
  networkPassphrase: NETWORK_PASSPHRASE,
  rpcUrl: RPC_URL,
  publicKey: AGENT_PK,
  signTransaction: signer.signTransaction,
});

export interface PrismState {
  balance: bigint;
  daySpent: bigint;
  dailyLimit: bigint;
  perTaskLimit: bigint;
  admin: string;
  agent: string;
  token: string;
}

export async function readState(): Promise<PrismState> {
  const [bal, cfg, day] = await Promise.all([
    treasury.balance(),
    treasury.get_config(),
    treasury.day_spent(),
  ]);
  const c = cfg.result;
  return {
    balance: bal.result,
    daySpent: day.result,
    dailyLimit: c.daily_limit,
    perTaskLimit: c.per_task_limit,
    admin: c.admin,
    agent: c.agent,
    token: c.token,
  };
}

export async function readTaskSpent(taskId: bigint): Promise<bigint> {
  return (await treasury.task_spent({ task_id: taskId })).result;
}

export interface PayResult {
  ok: boolean;
  hash?: string;
  errorCode?: number;
  errorMessage?: string;
  /** true = an infra/concurrency hiccup (e.g. many users submitting at once →
   *  stale sequence), NOT a contract guardrail rejection. Safe to retry. */
  transient?: boolean;
}

const MAX_TRIES = 5;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function errText(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
}

/** A deterministic contract guardrail rejection (#1..#4). Never retried. */
function contractError(msg: string): { errorCode: number; errorMessage: string } | null {
  const m = msg.match(/Error\(Contract,\s*#?(\d+)\)/);
  if (!m) return null;
  const code = Number(m[1]);
  const known = (Errors as Record<number, { message: string }>)[code];
  return { errorCode: code, errorMessage: known?.message ?? `Contract error #${code}` };
}

/** Transient infra / concurrency errors — several judges submitting at the same
 *  instant share one agent account, so a tx can land on a stale sequence. These
 *  are safe to retry after re-fetching the sequence. */
function isTransient(msg: string): boolean {
  return /bad[_ ]?seq|sequence|tx_too_late|too[_ ]?late|timeout|timed out|deadline|429|too many|rate limit|50\d\b|service unavailable|temporar|unavailable|connection|network|fetch failed|failed to fetch|econn|reset by peer|try again/i.test(
    msg,
  );
}

export async function agentPay(
  taskId: bigint,
  to: string,
  amount: bigint,
): Promise<PayResult> {
  let lastMsg = "";
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    try {
      // pay() re-fetches the agent account (fresh sequence) on every attempt,
      // so a retry after a concurrent submission picks up the new sequence.
      const tx = await treasury.pay({ task_id: taskId, to, amount });
      const sent = await tx.signAndSend();
      const hash =
        (sent as { sendTransactionResponse?: { hash?: string } })
          .sendTransactionResponse?.hash;
      return { ok: true, hash };
    } catch (e) {
      const msg = errText(e);
      lastMsg = msg;
      const ce = contractError(msg);
      if (ce) return { ok: false, ...ce }; // real guardrail rejection — surface it
      if (attempt < MAX_TRIES - 1 && isTransient(msg)) {
        // back off with jitter so concurrent clients de-synchronise, then retry
        await sleep(220 * (attempt + 1) + Math.floor(Math.random() * 400));
        continue;
      }
      return { ok: false, transient: true, errorMessage: "Network busy — please try again" };
    }
  }
  return { ok: false, transient: true, errorMessage: lastMsg.slice(0, 120) || "Network busy" };
}
