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

describe("discoverTreasuries", () => {
  it("returns the wallet's registered treasuries", async () => {
    mocks.treasuries_of.mockResolvedValueOnce({ result: ["C1", "C2"] });
    expect(await discoverTreasuries("GADDR")).toEqual(["C1", "C2"]);
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
