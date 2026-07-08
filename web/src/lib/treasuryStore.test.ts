import { describe, it, expect, beforeEach } from "vitest";
import {
  getTreasuryId,
  setTreasuryId,
  clearTreasuryId,
  listTreasuries,
  setActiveTreasury,
} from "./treasuryStore";

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

  it("reads a legacy single-value key", () => {
    localStorage.setItem("prism_treasury:GADDR", "COLD");
    expect(getTreasuryId("GADDR")).toBe("COLD");
    expect(listTreasuries("GADDR")).toEqual(["COLD"]);
  });

  it("second setTreasuryId keeps the first treasury and switches active", () => {
    setTreasuryId("GA", "C1");
    setTreasuryId("GA", "C2");
    expect(getTreasuryId("GA")).toBe("C2");
    expect(listTreasuries("GA")).toEqual(["C1", "C2"]);
  });

  it("folds the legacy id into the list on first write and removes the legacy key", () => {
    localStorage.setItem("prism_treasury:GA", "COLD");
    setTreasuryId("GA", "CNEW");
    expect(listTreasuries("GA")).toEqual(["COLD", "CNEW"]);
    expect(getTreasuryId("GA")).toBe("CNEW");
    expect(localStorage.getItem("prism_treasury:GA")).toBeNull();
  });

  it("re-setting a known id re-activates it without duplicating", () => {
    setTreasuryId("GA", "C1");
    setTreasuryId("GA", "C2");
    setTreasuryId("GA", "C1");
    expect(listTreasuries("GA")).toEqual(["C1", "C2"]);
    expect(getTreasuryId("GA")).toBe("C1");
  });

  it("setActiveTreasury switches among known ids and ignores unknown ids", () => {
    setTreasuryId("GA", "C1");
    setTreasuryId("GA", "C2");
    setActiveTreasury("GA", "C1");
    expect(getTreasuryId("GA")).toBe("C1");
    setActiveTreasury("GA", "CUNKNOWN");
    expect(getTreasuryId("GA")).toBe("C1");
    expect(listTreasuries("GA")).toEqual(["C1", "C2"]);
  });

  it("clearTreasuryId removes the active id and promotes the most recent remaining", () => {
    setTreasuryId("GA", "C1");
    setTreasuryId("GA", "C2");
    clearTreasuryId("GA");
    expect(getTreasuryId("GA")).toBe("C1");
    expect(listTreasuries("GA")).toEqual(["C1"]);
  });

  it("clearTreasuryId on the last id leaves no keys behind", () => {
    localStorage.setItem("prism_treasury:GA", "COLD");
    setTreasuryId("GA", "COLD");
    clearTreasuryId("GA");
    expect(getTreasuryId("GA")).toBeNull();
    expect(listTreasuries("GA")).toEqual([]);
    expect(localStorage.getItem("prism_treasury:GA")).toBeNull();
    expect(localStorage.getItem("prism_treasuries:GA")).toBeNull();
  });

  it("corrupt JSON in the new key is treated as absent (legacy fallback wins)", () => {
    localStorage.setItem("prism_treasuries:GA", "not-json");
    expect(getTreasuryId("GA")).toBeNull();
    expect(listTreasuries("GA")).toEqual([]);
    localStorage.setItem("prism_treasury:GA", "COLD");
    expect(getTreasuryId("GA")).toBe("COLD");
  });
});
