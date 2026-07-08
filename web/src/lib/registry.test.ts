import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  treasuries_of: vi.fn(),
  register: vi.fn(),
}));

vi.mock("./registryClient", () => ({
  // A real class so `new Client(...)` works — arrow-fn mocks aren't constructable.
  Client: class {
    treasuries_of = mocks.treasuries_of;
    register = mocks.register;
  },
}));

import { discoverTreasuries, registerTreasury } from "./registry";

// Real, checksum-valid contract ids — discoverTreasuries StrKey-filters its results.
const T1 = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const T2 = "CBEPVXK6BN2FZ3IYHV5KQUGROFHNBWBYHKHRZ5U3O7UWGIOPFOFE4ZE7";

describe("discoverTreasuries", () => {
  it("returns the wallet's registered treasuries", async () => {
    mocks.treasuries_of.mockResolvedValueOnce({ result: [T1, T2] });
    expect(await discoverTreasuries("GADDR")).toEqual([T1, T2]);
  });

  it("filters malformed ids so a bad registry entry can't wedge the workspace", async () => {
    mocks.treasuries_of.mockResolvedValueOnce({ result: ["not-a-contract", T1, "C1"] });
    expect(await discoverTreasuries("GADDR")).toEqual([T1]);
  });

  it("returns [] when the registry is unreachable (recovery must never break connect)", async () => {
    mocks.treasuries_of.mockRejectedValueOnce(new Error("rpc down"));
    expect(await discoverTreasuries("GADDR")).toEqual([]);
  });

  it("returns [] for a missing result", async () => {
    mocks.treasuries_of.mockResolvedValueOnce({ result: undefined });
    expect(await discoverTreasuries("GADDR")).toEqual([]);
  });
});

describe("registerTreasury", () => {
  it("builds the register call for the owner and signs + sends it", async () => {
    const signAndSend = vi.fn().mockResolvedValue({});
    mocks.register.mockResolvedValueOnce({ signAndSend });
    await registerTreasury("GADDR", { signTransaction: vi.fn() }, "CTREASURY");
    expect(mocks.register).toHaveBeenCalledWith({ owner: "GADDR", treasury: "CTREASURY" });
    expect(signAndSend).toHaveBeenCalled();
  });

  it("propagates a decline so the caller's best-effort catch handles it", async () => {
    mocks.register.mockRejectedValueOnce(new Error("User declined"));
    await expect(
      registerTreasury("GADDR", { signTransaction: vi.fn() }, "CTREASURY"),
    ).rejects.toThrow("User declined");
  });
});
