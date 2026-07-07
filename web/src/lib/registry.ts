// On-chain treasury discovery (M2): after a deploy we best-effort register the
// treasury under the owner's wallet in the TreasuryRegistry contract, and on a
// fresh device we can recover it with an unsigned simulation — localStorage is
// no longer the only copy of "which treasury is mine".
import { Client } from "./registryClient";
import { isValidContractId } from "./userTreasury";
import type { ContractSigner } from "./walletSigner";
import { NETWORK_PASSPHRASE, REGISTRY_ID, RPC_URL } from "../config";

function makeRegistry(publicKey: string, signer?: ContractSigner): Client {
  return new Client({
    contractId: REGISTRY_ID,
    networkPassphrase: NETWORK_PASSPHRASE,
    rpcUrl: RPC_URL,
    publicKey,
    ...(signer ? { signTransaction: signer.signTransaction } : {}),
  });
}

/** Record the treasury under the owner's wallet (owner-signed). Callers treat this
 *  as best-effort: a decline or RPC failure must never break the deploy flow. */
export async function registerTreasury(
  address: string,
  signer: ContractSigner,
  treasuryId: string,
): Promise<void> {
  const tx = await makeRegistry(address, signer).register({ owner: address, treasury: treasuryId });
  await tx.signAndSend();
}

/** Every treasury this wallet registered, oldest → newest — an unsigned read.
 *  Returns [] when the wallet has none or the registry is unreachable; malformed
 *  ids are filtered so a bad registry entry can never wedge the workspace. */
export async function discoverTreasuries(address: string): Promise<string[]> {
  try {
    const res = await makeRegistry(address).treasuries_of({ owner: address });
    return (res.result ?? []).filter(isValidContractId);
  } catch {
    return [];
  }
}
