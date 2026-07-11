import { describe, it, expect } from "vitest";
import { mergeLedger, loadLedger, recordEvents, type KVStore } from "./eventLedger";
import type { FeedEvent } from "./events";

const ev = (id: string, at: string, kind = "paid", amountXlm = 1): FeedEvent => ({
  id,
  kind,
  label: `event ${id}`,
  txHash: `tx-${id}`,
  at,
  amountXlm,
});

function fakeStore(): KVStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("mergeLedger", () => {
  it("unions by id — re-scanned events don't double count", () => {
    const a = [ev("1", "2026-07-01T10:00:00Z"), ev("2", "2026-07-02T10:00:00Z")];
    const b = [ev("2", "2026-07-02T10:00:00Z"), ev("3", "2026-07-03T10:00:00Z")];
    const out = mergeLedger(a, b);
    expect(out.map((e) => e.id)).toEqual(["1", "2", "3"]);
  });

  it("keeps events the fresh scan no longer sees (the retention-window case)", () => {
    const stored = [ev("old", "2026-07-01T10:00:00Z")];
    const freshScanMissingOld = [ev("new", "2026-07-10T10:00:00Z")];
    const out = mergeLedger(stored, freshScanMissingOld);
    expect(out.map((e) => e.id)).toEqual(["old", "new"]);
  });

  it("sorts chronologically regardless of input order", () => {
    const out = mergeLedger([ev("b", "2026-07-05T10:00:00Z")], [ev("a", "2026-07-01T10:00:00Z")]);
    expect(out.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("caps to the newest N events", () => {
    const stored = [ev("1", "2026-07-01T10:00:00Z"), ev("2", "2026-07-02T10:00:00Z")];
    const fresh = [ev("3", "2026-07-03T10:00:00Z")];
    const out = mergeLedger(stored, fresh, 2);
    expect(out.map((e) => e.id)).toEqual(["2", "3"]);
  });
});

describe("loadLedger / recordEvents", () => {
  it("roundtrips through the store", () => {
    const store = fakeStore();
    recordEvents("C1", [ev("1", "2026-07-01T10:00:00Z")], store);
    recordEvents("C1", [ev("2", "2026-07-02T10:00:00Z")], store);
    expect(loadLedger("C1", store).map((e) => e.id)).toEqual(["1", "2"]);
  });

  it("scopes ledgers per treasury", () => {
    const store = fakeStore();
    recordEvents("C1", [ev("1", "2026-07-01T10:00:00Z")], store);
    recordEvents("C2", [ev("9", "2026-07-02T10:00:00Z")], store);
    expect(loadLedger("C1", store).map((e) => e.id)).toEqual(["1"]);
    expect(loadLedger("C2", store).map((e) => e.id)).toEqual(["9"]);
  });

  it("survives a missing store (returns the in-memory merge)", () => {
    const out = recordEvents("C1", [ev("1", "2026-07-01T10:00:00Z")], null);
    expect(out.map((e) => e.id)).toEqual(["1"]);
  });

  it("treats corrupted JSON as an empty ledger", () => {
    const store = fakeStore();
    store.setItem("prism_ledger:C1", "{not json");
    expect(loadLedger("C1", store)).toEqual([]);
  });
});
