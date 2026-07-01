import { describe, it, expect } from "vitest";
import { buildActivityRow } from "./activity";

describe("buildActivityRow", () => {
  it("maps a full input to the activity row shape", () => {
    expect(
      buildActivityRow({ walletAddress: "GABC", treasuryId: "CXYZ", action: "pay", txHash: "HASH", amountXlm: 5 }),
    ).toEqual({ wallet_address: "GABC", treasury_id: "CXYZ", action: "pay", tx_hash: "HASH", amount_xlm: 5 });
  });

  it("nulls optional fields when absent", () => {
    expect(buildActivityRow({ walletAddress: "GABC", action: "deploy" })).toEqual({
      wallet_address: "GABC",
      treasury_id: null,
      action: "deploy",
      tx_hash: null,
      amount_xlm: null,
    });
  });

  it("clamps overlong values to the column limits", () => {
    const row = buildActivityRow({
      walletAddress: "G".repeat(70),
      treasuryId: "C".repeat(70),
      action: "fund",
      txHash: "H".repeat(90),
    });
    expect(row.wallet_address.length).toBe(64);
    expect(row.treasury_id?.length).toBe(64);
    expect(row.tx_hash?.length).toBe(80);
  });
});
