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





export interface Client {
  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Record that `owner` operates `treasury`. Owner-signed; duplicates are a no-op.
   */
  register: ({owner, treasury}: {owner: string, treasury: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a treasuries_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Every treasury registered by `owner`, oldest → newest (empty when none).
   */
  treasuries_of: ({owner}: {owner: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
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
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAE5SZWNvcmQgdGhhdCBgb3duZXJgIG9wZXJhdGVzIGB0cmVhc3VyeWAuIE93bmVyLXNpZ25lZDsgZHVwbGljYXRlcyBhcmUgYSBuby1vcC4AAAAAAAhyZWdpc3RlcgAAAAIAAAAAAAAABW93bmVyAAAAAAAAEwAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAA==",
        "AAAAAAAAAEpFdmVyeSB0cmVhc3VyeSByZWdpc3RlcmVkIGJ5IGBvd25lcmAsIG9sZGVzdCDihpIgbmV3ZXN0IChlbXB0eSB3aGVuIG5vbmUpLgAAAAAADXRyZWFzdXJpZXNfb2YAAAAAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAABAAAD6gAAABM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    register: this.txFromJSON<null>,
        treasuries_of: this.txFromJSON<Array<string>>
  }
}