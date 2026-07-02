// Per-user treasury operations: deploy a fresh treasury owned by the connected wallet,
// fund it, govern its policy, and spend from it — all signed by the user's wallet. This is
// the per-user analogue of prism.ts (which drives the single embedded-agent demo treasury).
import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { Client, Errors } from "./treasuryClient";
import type { ContractSigner } from "./walletSigner";
import { NETWORK_PASSPHRASE, RPC_URL } from "../config";

// Native XLM SAC on testnet — the token each user treasury holds and spends.
export const XLM_SAC = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
// Treasury WASM already installed on-chain — deploy just instantiates a new contract from it.
export const TREASURY_WASM_HASH =
  "41c8bb1f0b4d9bd7b89c3a855ee87cb56971a256fe110cd2860d406dde040c2b";

const XLM_UNIT = 10_000_000;

/** Whether a pasted string is a well-formed contract id (C…, 56 chars, valid checksum). */
export function isValidContractId(id: string): boolean {
  return StrKey.isValidContract(id);
}

/** XLM (float) -> i128 stroops (7 decimals), rounded to avoid float drift. */
export function toStroops(xlm: number): bigint {
  if (!Number.isFinite(xlm) || xlm < 0) {
    throw new Error("Amount must be a non-negative number.");
  }
  return BigInt(Math.round(xlm * XLM_UNIT));
}

export interface PrismState {
  balance: bigint;
  daySpent: bigint;
  dailyLimit: bigint;
  perTaskLimit: bigint;
  admin: string;
  agent: string;
  token: string;
}

export interface PayResult {
  ok: boolean;
  hash?: string;
  errorCode?: number;
  errorMessage?: string;
}

/** A treasury Client bound to a runtime contract id + the connected wallet as signer. */
export function makeTreasury(contractId: string, address: string, signer: ContractSigner): Client {
  return new Client({
    contractId,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey: address,
    signTransaction: signer.signTransaction,
  });
}

/** Deploy a fresh treasury owned by `address` (admin = agent = the wallet). Returns its id. */
export async function deployTreasury(
  address: string,
  signer: ContractSigner,
  dailyXlm: number,
  perTaskXlm: number,
): Promise<string> {
  const tx = await Client.deploy(
    {
      admin: address,
      agent: address,
      token: XLM_SAC,
      daily_limit: toStroops(dailyXlm),
      per_task_limit: toStroops(perTaskXlm),
    },
    {
      wasmHash: TREASURY_WASM_HASH,
      networkPassphrase: NETWORK_PASSPHRASE,
      rpcUrl: RPC_URL,
      publicKey: address,
      signTransaction: signer.signTransaction,
    },
  );
  const { result } = await tx.signAndSend();
  return result.options.contractId;
}

/** Fund a treasury by transferring native XLM from the wallet into the treasury contract
 *  (a SAC transfer; the `from` auth is the tx source, so the wallet signature covers it). */
export async function fundTreasury(
  contractId: string,
  address: string,
  signer: ContractSigner,
  amountXlm: number,
): Promise<string> {
  const server = new rpc.Server(RPC_URL);
  const account = await server.getAccount(address);
  const sac = new Contract(XLM_SAC);
  const op = sac.call(
    "transfer",
    new Address(address).toScVal(),
    new Address(contractId).toScVal(),
    nativeToScVal(toStroops(amountXlm), { type: "i128" }),
  );
  const built = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(180)
    .build();
  const prepared = await server.prepareTransaction(built);
  const { signedTxXdr } = await signer.signTransaction(prepared.toXDR());
  const sent = await server.sendTransaction(
    TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE),
  );
  return sent.hash;
}

export async function readState(treasury: Client): Promise<PrismState> {
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

export async function addPayee(treasury: Client, payee: string): Promise<void> {
  const tx = await treasury.add_payee({ payee });
  await tx.signAndSend();
}

export async function removePayee(treasury: Client, payee: string): Promise<void> {
  const tx = await treasury.remove_payee({ payee });
  await tx.signAndSend();
}

/** Spend from the treasury. The contract enforces the policy and rejects violations
 *  on-chain (#1..#4) — those rejections are the product working, surfaced as messages. */
export async function pay(
  treasury: Client,
  taskId: bigint,
  to: string,
  amountXlm: number,
): Promise<PayResult> {
  try {
    const tx = await treasury.pay({ task_id: taskId, to, amount: toStroops(amountXlm) });
    const sent = await tx.signAndSend();
    const hash = (sent as { sendTransactionResponse?: { hash?: string } }).sendTransactionResponse
      ?.hash;
    return { ok: true, hash };
  } catch (e) {
    const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
    const m = msg.match(/Error\(Contract,\s*#?(\d+)\)/);
    if (m) {
      const code = Number(m[1]);
      const known = (Errors as Record<number, { message: string }>)[code];
      return { ok: false, errorCode: code, errorMessage: known?.message ?? `Contract error #${code}` };
    }
    return { ok: false, errorMessage: msg.slice(0, 160) || "Payment failed." };
  }
}
