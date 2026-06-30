import { describe, it, expect, vi } from "vitest";
import { makeWalletSigner } from "./walletSigner";

const PASS = "Test SDF Network ; September 2015";

describe("makeWalletSigner", () => {
  it("signs with the bound address + default passphrase and maps to the contract-signer shape", async () => {
    const signTransaction = vi.fn().mockResolvedValue({ signedTxXdr: "SIGNED" });
    const signer = makeWalletSigner({ signTransaction }, "GADDR", PASS);

    const out = await signer.signTransaction("XDR");

    expect(signTransaction).toHaveBeenCalledWith("XDR", {
      networkPassphrase: PASS,
      address: "GADDR",
    });
    // contract Client expects { signedTxXdr, signerAddress }; signerAddress falls back to the bound address
    expect(out).toEqual({ signedTxXdr: "SIGNED", signerAddress: "GADDR" });
  });

  it("honours an explicit passphrase and the kit's own signerAddress when returned", async () => {
    const signTransaction = vi.fn().mockResolvedValue({ signedTxXdr: "S2", signerAddress: "GKIT" });
    const signer = makeWalletSigner({ signTransaction }, "GADDR", PASS);

    const out = await signer.signTransaction("XDR", { networkPassphrase: "OTHER" });

    expect(signTransaction).toHaveBeenCalledWith("XDR", { networkPassphrase: "OTHER", address: "GADDR" });
    expect(out).toEqual({ signedTxXdr: "S2", signerAddress: "GKIT" });
  });
});
