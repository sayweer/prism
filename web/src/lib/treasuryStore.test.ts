import { describe, it, expect, beforeEach } from "vitest";
import { getTreasuryId, setTreasuryId, clearTreasuryId } from "./treasuryStore";

beforeEach(() => {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k in store) delete store[k];
    },
    key: () => null,
    length: 0,
  } as Storage;
});

describe("treasuryStore", () => {
  it("set then get returns the id", () => {
    setTreasuryId("GADDR", "CTREASURY");
    expect(getTreasuryId("GADDR")).toBe("CTREASURY");
  });

  it("get for an unknown address returns null", () => {
    expect(getTreasuryId("GUNKNOWN")).toBeNull();
  });

  it("clear removes the mapping", () => {
    setTreasuryId("GADDR", "CTREASURY");
    clearTreasuryId("GADDR");
    expect(getTreasuryId("GADDR")).toBeNull();
  });

  it("keeps treasuries separate per address", () => {
    setTreasuryId("GA", "C1");
    setTreasuryId("GB", "C2");
    expect(getTreasuryId("GA")).toBe("C1");
    expect(getTreasuryId("GB")).toBe("C2");
  });
});
