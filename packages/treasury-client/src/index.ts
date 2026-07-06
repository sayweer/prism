import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"InvalidAmount"},
  2: {message:"PayeeNotWhitelisted"},
  3: {message:"ExceedsTaskLimit"},
  4: {message:"ExceedsDailyLimit"},
  5: {message:"BelowReputationThreshold"},
  6: {message:"InsufficientFreeBalance"},
  7: {message:"EscrowNotFound"},
  8: {message:"DeadlineNotReached"}
}


export interface Config {
  /**
 * Owner of the funds; the only one who can change the policy.
 */
admin: string;
  /**
 * The agent allowed to trigger payments (must sign each `pay`).
 */
agent: string;
  /**
 * Max total spend allowed per UTC calendar day (resets at 00:00 UTC).
 */
daily_limit: i128;
  /**
 * Max spend allowed in a single payment.
 */
per_task_limit: i128;
  /**
 * SEP-41 / SAC token the treasury holds and spends (e.g. USDC).
 */
token: string;
}


/**
 * An outcome-bound payment: `amount` is reserved (locked) in the treasury for
 * `payee` against `task_id`, releasable on approval or refundable after `deadline`
 * (UNIX seconds). The funds never leave until release — refund just unlocks them.
 */
export interface Escrow {
  amount: i128;
  deadline: u64;
  payee: string;
  task_id: u64;
}

export type DataKey = {tag: "Config", values: void} | {tag: "Payee", values: readonly [string]} | {tag: "DaySpent", values: readonly [u64]} | {tag: "TaskSpent", values: readonly [u64]} | {tag: "RepRegistry", values: void} | {tag: "MinReputation", values: void} | {tag: "EscrowEntry", values: readonly [u64]} | {tag: "NextEscrowId", values: void} | {tag: "Locked", values: void};

export interface Client {
  /**
   * Construct and simulate a pay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The agent asks the treasury to pay `amount` to `to` for `task_id`.
   * The contract enforces the policy and rejects any violation on-chain.
   * Only the free (unlocked) balance is spendable — funds reserved by open
   * escrows cannot be paid out directly.
   */
  pay: ({task_id, to, amount}: {task_id: u64, to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a locked transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Total funds currently reserved by open escrows (treasury balance minus this
   * is the spendable free balance).
   */
  locked: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  balance: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a is_payee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_payee: ({payee}: {payee: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a add_payee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Whitelist a payee. Admin-only.
   */
  add_payee: ({payee}: {payee: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a day_spent transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  day_spent: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Config>>

  /**
   * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Escrow>>>

  /**
   * Construct and simulate a task_spent transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  task_spent: ({task_id}: {task_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a remove_payee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Remove a payee from the whitelist. Admin-only.
   */
  remove_payee: ({payee}: {payee: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a create_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Agent reserves `amount` for `payee` against a future-delivered task. The funds
   * stay in the treasury (locked, not transferred) until released on approval or
   * refunded after `deadline`. Subject to the same payee gate + per-task limit as
   * a direct payment; the daily limit is enforced later, at release.
   */
  create_escrow: ({task_id, payee, amount, deadline}: {task_id: u64, payee: string, amount: i128, deadline: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a refund_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * After the deadline, the agent reclaims an undelivered escrow — the lock is
   * released back to the treasury's free balance. No transfer, no spend recorded.
   */
  refund_escrow: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a release_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin (the owner / hirer) approves delivery → release the locked funds to the
   * payee. The daily limit is enforced here, at the real moment of outflow, and
   * the spend is accounted per task exactly like a direct `pay`.
   */
  release_escrow: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_reputation_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The active reputation gate, if any: `(registry, min_reputation)`.
   */
  get_reputation_policy: (options?: MethodOptions) => Promise<AssembledTransaction<Option<readonly [string, i128]>>>

  /**
   * Construct and simulate a set_reputation_policy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set (or update) the reputation gate. Admin-only. With `min_reputation > 0`,
   * a payee that is NOT on the whitelist can still be paid when its score from
   * `registry` is >= `min_reputation` — turning the static allowlist into an
   * earned-trust gate. Set `min_reputation = 0` to disable (whitelist-only).
   */
  set_reputation_policy: ({registry, min_reputation}: {registry: string, min_reputation: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, agent, token, daily_limit, per_task_limit}: {admin: string, agent: string, token: string, daily_limit: i128, per_task_limit: i128},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, agent, token, daily_limit, per_task_limit}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACAAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAEAAAAAAAAAE1BheWVlTm90V2hpdGVsaXN0ZWQAAAAAAgAAAAAAAAAQRXhjZWVkc1Rhc2tMaW1pdAAAAAMAAAAAAAAAEUV4Y2VlZHNEYWlseUxpbWl0AAAAAAAABAAAAAAAAAAYQmVsb3dSZXB1dGF0aW9uVGhyZXNob2xkAAAABQAAAAAAAAAXSW5zdWZmaWNpZW50RnJlZUJhbGFuY2UAAAAABgAAAAAAAAAORXNjcm93Tm90Rm91bmQAAAAAAAcAAAAAAAAAEkRlYWRsaW5lTm90UmVhY2hlZAAAAAAACA==",
        "AAAAAAAAAPVUaGUgYWdlbnQgYXNrcyB0aGUgdHJlYXN1cnkgdG8gcGF5IGBhbW91bnRgIHRvIGB0b2AgZm9yIGB0YXNrX2lkYC4KVGhlIGNvbnRyYWN0IGVuZm9yY2VzIHRoZSBwb2xpY3kgYW5kIHJlamVjdHMgYW55IHZpb2xhdGlvbiBvbi1jaGFpbi4KT25seSB0aGUgZnJlZSAodW5sb2NrZWQpIGJhbGFuY2UgaXMgc3BlbmRhYmxlIOKAlCBmdW5kcyByZXNlcnZlZCBieSBvcGVuCmVzY3Jvd3MgY2Fubm90IGJlIHBhaWQgb3V0IGRpcmVjdGx5LgAAAAAAAANwYXkAAAAAAwAAAAAAAAAHdGFza19pZAAAAAAGAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAQAAAAAAAAAAAAAABkNvbmZpZwAAAAAABQAAADtPd25lciBvZiB0aGUgZnVuZHM7IHRoZSBvbmx5IG9uZSB3aG8gY2FuIGNoYW5nZSB0aGUgcG9saWN5LgAAAAAFYWRtaW4AAAAAAAATAAAAPVRoZSBhZ2VudCBhbGxvd2VkIHRvIHRyaWdnZXIgcGF5bWVudHMgKG11c3Qgc2lnbiBlYWNoIGBwYXlgKS4AAAAAAAAFYWdlbnQAAAAAAAATAAAAQ01heCB0b3RhbCBzcGVuZCBhbGxvd2VkIHBlciBVVEMgY2FsZW5kYXIgZGF5IChyZXNldHMgYXQgMDA6MDAgVVRDKS4AAAAAC2RhaWx5X2xpbWl0AAAAAAsAAAAmTWF4IHNwZW5kIGFsbG93ZWQgaW4gYSBzaW5nbGUgcGF5bWVudC4AAAAAAA5wZXJfdGFza19saW1pdAAAAAAACwAAAD1TRVAtNDEgLyBTQUMgdG9rZW4gdGhlIHRyZWFzdXJ5IGhvbGRzIGFuZCBzcGVuZHMgKGUuZy4gVVNEQykuAAAAAAAABXRva2VuAAAAAAAAEw==",
        "AAAAAQAAAO5BbiBvdXRjb21lLWJvdW5kIHBheW1lbnQ6IGBhbW91bnRgIGlzIHJlc2VydmVkIChsb2NrZWQpIGluIHRoZSB0cmVhc3VyeSBmb3IKYHBheWVlYCBhZ2FpbnN0IGB0YXNrX2lkYCwgcmVsZWFzYWJsZSBvbiBhcHByb3ZhbCBvciByZWZ1bmRhYmxlIGFmdGVyIGBkZWFkbGluZWAKKFVOSVggc2Vjb25kcykuIFRoZSBmdW5kcyBuZXZlciBsZWF2ZSB1bnRpbCByZWxlYXNlIOKAlCByZWZ1bmQganVzdCB1bmxvY2tzIHRoZW0uAAAAAAAAAAAABkVzY3JvdwAAAAAABAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhkZWFkbGluZQAAAAYAAAAAAAAABXBheWVlAAAAAAAAEwAAAAAAAAAHdGFza19pZAAAAAAG",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACQAAAAAAAAAAAAAABkNvbmZpZwAAAAAAAQAAAAAAAAAFUGF5ZWUAAAAAAAABAAAAEwAAAAEAAAAAAAAACERheVNwZW50AAAAAQAAAAYAAAABAAAAAAAAAAlUYXNrU3BlbnQAAAAAAAABAAAABgAAAAAAAAAAAAAAC1JlcFJlZ2lzdHJ5AAAAAAAAAAAAAAAADU1pblJlcHV0YXRpb24AAAAAAAABAAAAAAAAAAtFc2Nyb3dFbnRyeQAAAAABAAAABgAAAAAAAAAAAAAADE5leHRFc2Nyb3dJZAAAAAAAAAAAAAAABkxvY2tlZAAA",
        "AAAAAAAAAGtUb3RhbCBmdW5kcyBjdXJyZW50bHkgcmVzZXJ2ZWQgYnkgb3BlbiBlc2Nyb3dzICh0cmVhc3VyeSBiYWxhbmNlIG1pbnVzIHRoaXMKaXMgdGhlIHNwZW5kYWJsZSBmcmVlIGJhbGFuY2UpLgAAAAAGbG9ja2VkAAAAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAHYmFsYW5jZQAAAAAAAAAAAQAAAAs=",
        "AAAAAAAAAAAAAAAIaXNfcGF5ZWUAAAABAAAAAAAAAAVwYXllZQAAAAAAABMAAAABAAAAAQ==",
        "AAAAAAAAAB5XaGl0ZWxpc3QgYSBwYXllZS4gQWRtaW4tb25seS4AAAAAAAlhZGRfcGF5ZWUAAAAAAAABAAAAAAAAAAVwYXllZQAAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAJZGF5X3NwZW50AAAAAAAAAAAAAAEAAAAL",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAfQAAAABkNvbmZpZwAA",
        "AAAAAAAAAAAAAAAKZ2V0X2VzY3JvdwAAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6AAAB9AAAAAGRXNjcm93AAA=",
        "AAAAAAAAAAAAAAAKdGFza19zcGVudAAAAAAAAQAAAAAAAAAHdGFza19pZAAAAAAGAAAAAQAAAAs=",
        "AAAAAAAAAC5SZW1vdmUgYSBwYXllZSBmcm9tIHRoZSB3aGl0ZWxpc3QuIEFkbWluLW9ubHkuAAAAAAAMcmVtb3ZlX3BheWVlAAAAAQAAAAAAAAAFcGF5ZWUAAAAAAAATAAAAAA==",
        "AAAAAAAAADxBdG9taWMgaW5pdCBhdCBkZXBsb3kgdGltZSAobm8gZnJvbnQtcnVubmFibGUgYGluaXRpYWxpemVgKS4AAAANX19jb25zdHJ1Y3RvcgAAAAAAAAUAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFYWdlbnQAAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAAC2RhaWx5X2xpbWl0AAAAAAsAAAAAAAAADnBlcl90YXNrX2xpbWl0AAAAAAALAAAAAA==",
        "AAAAAAAAASpBZ2VudCByZXNlcnZlcyBgYW1vdW50YCBmb3IgYHBheWVlYCBhZ2FpbnN0IGEgZnV0dXJlLWRlbGl2ZXJlZCB0YXNrLiBUaGUgZnVuZHMKc3RheSBpbiB0aGUgdHJlYXN1cnkgKGxvY2tlZCwgbm90IHRyYW5zZmVycmVkKSB1bnRpbCByZWxlYXNlZCBvbiBhcHByb3ZhbCBvcgpyZWZ1bmRlZCBhZnRlciBgZGVhZGxpbmVgLiBTdWJqZWN0IHRvIHRoZSBzYW1lIHBheWVlIGdhdGUgKyBwZXItdGFzayBsaW1pdCBhcwphIGRpcmVjdCBwYXltZW50OyB0aGUgZGFpbHkgbGltaXQgaXMgZW5mb3JjZWQgbGF0ZXIsIGF0IHJlbGVhc2UuAAAAAAANY3JlYXRlX2VzY3JvdwAAAAAAAAQAAAAAAAAAB3Rhc2tfaWQAAAAABgAAAAAAAAAFcGF5ZWUAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACGRlYWRsaW5lAAAABgAAAAEAAAPpAAAABgAAAAM=",
        "AAAAAAAAAJpBZnRlciB0aGUgZGVhZGxpbmUsIHRoZSBhZ2VudCByZWNsYWltcyBhbiB1bmRlbGl2ZXJlZCBlc2Nyb3cg4oCUIHRoZSBsb2NrIGlzCnJlbGVhc2VkIGJhY2sgdG8gdGhlIHRyZWFzdXJ5J3MgZnJlZSBiYWxhbmNlLiBObyB0cmFuc2Zlciwgbm8gc3BlbmQgcmVjb3JkZWQuAAAAAAANcmVmdW5kX2VzY3JvdwAAAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAANhBZG1pbiAodGhlIG93bmVyIC8gaGlyZXIpIGFwcHJvdmVzIGRlbGl2ZXJ5IOKGkiByZWxlYXNlIHRoZSBsb2NrZWQgZnVuZHMgdG8gdGhlCnBheWVlLiBUaGUgZGFpbHkgbGltaXQgaXMgZW5mb3JjZWQgaGVyZSwgYXQgdGhlIHJlYWwgbW9tZW50IG9mIG91dGZsb3csIGFuZAp0aGUgc3BlbmQgaXMgYWNjb3VudGVkIHBlciB0YXNrIGV4YWN0bHkgbGlrZSBhIGRpcmVjdCBgcGF5YC4AAAAOcmVsZWFzZV9lc2Nyb3cAAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAEFUaGUgYWN0aXZlIHJlcHV0YXRpb24gZ2F0ZSwgaWYgYW55OiBgKHJlZ2lzdHJ5LCBtaW5fcmVwdXRhdGlvbilgLgAAAAAAABVnZXRfcmVwdXRhdGlvbl9wb2xpY3kAAAAAAAAAAAAAAQAAA+gAAAPtAAAAAgAAABMAAAAL",
        "AAAAAAAAASpTZXQgKG9yIHVwZGF0ZSkgdGhlIHJlcHV0YXRpb24gZ2F0ZS4gQWRtaW4tb25seS4gV2l0aCBgbWluX3JlcHV0YXRpb24gPiAwYCwKYSBwYXllZSB0aGF0IGlzIE5PVCBvbiB0aGUgd2hpdGVsaXN0IGNhbiBzdGlsbCBiZSBwYWlkIHdoZW4gaXRzIHNjb3JlIGZyb20KYHJlZ2lzdHJ5YCBpcyA+PSBgbWluX3JlcHV0YXRpb25gIOKAlCB0dXJuaW5nIHRoZSBzdGF0aWMgYWxsb3dsaXN0IGludG8gYW4KZWFybmVkLXRydXN0IGdhdGUuIFNldCBgbWluX3JlcHV0YXRpb24gPSAwYCB0byBkaXNhYmxlICh3aGl0ZWxpc3Qtb25seSkuAAAAAAAVc2V0X3JlcHV0YXRpb25fcG9saWN5AAAAAAAAAgAAAAAAAAAIcmVnaXN0cnkAAAATAAAAAAAAAA5taW5fcmVwdXRhdGlvbgAAAAAACwAAAAA=" ]),
      options
    )
  }
  public readonly fromJSON = {
    pay: this.txFromJSON<Result<void>>,
        locked: this.txFromJSON<i128>,
        balance: this.txFromJSON<i128>,
        is_payee: this.txFromJSON<boolean>,
        add_payee: this.txFromJSON<null>,
        day_spent: this.txFromJSON<i128>,
        get_config: this.txFromJSON<Config>,
        get_escrow: this.txFromJSON<Option<Escrow>>,
        task_spent: this.txFromJSON<i128>,
        remove_payee: this.txFromJSON<null>,
        create_escrow: this.txFromJSON<Result<u64>>,
        refund_escrow: this.txFromJSON<Result<void>>,
        release_escrow: this.txFromJSON<Result<void>>,
        get_reputation_policy: this.txFromJSON<Option<readonly [string, i128]>>,
        set_reputation_policy: this.txFromJSON<null>
  }
}