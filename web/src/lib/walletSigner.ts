// Adapts a StellarWalletsKit-style signer to the shape the
// `@stellar/stellar-sdk/contract` Client expects (the same return shape as
// `basicNodeSigner`): `(xdr, opts?) => Promise<{ signedTxXdr, signerAddress }>`.
// Kept pure (the kit is injected) so it unit-tests without the kit's DOM-bound init.

export interface KitSigner {
  signTransaction(
    xdr: string,
    opts: { networkPassphrase?: string; address?: string },
  ): Promise<{ signedTxXdr: string; signerAddress?: string }>;
}

export interface ContractSigner {
  signTransaction: (
    xdr: string,
    opts?: { networkPassphrase?: string },
  ) => Promise<{ signedTxXdr: string; signerAddress: string }>;
}

/** Bind a connected wallet `address` to a contract-client signer driven by `kit`. */
export function makeWalletSigner(
  kit: KitSigner,
  address: string,
  defaultPassphrase: string,
): ContractSigner {
  return {
    signTransaction: async (xdr, opts) => {
      const res = await kit.signTransaction(xdr, {
        networkPassphrase: opts?.networkPassphrase ?? defaultPassphrase,
        address,
      });
      return { signedTxXdr: res.signedTxXdr, signerAddress: res.signerAddress ?? address };
    },
  };
}
