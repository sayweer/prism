import { describe, it, expect, beforeEach } from "vitest";
import {
  spendSeries,
  agentScorecard,
  trackError,
  trackViolation,
  getMonitor,
  resetMonitor,
} from "./analytics";
import type { FeedEvent } from "./events";

const ev = (kind: string, at: string, amountXlm?: number): FeedEvent => ({
  id: at,
  kind,
  label: "",
  txHash: "h",
  at,
  amountXlm,
});

describe("spendSeries", () => {
  it("keeps only paid events with their xlm + timestamp", () => {
    const out = spendSeries([ev("paid", "t1", 3), ev("attested", "t2"), ev("paid", "t3", 2)]);
    expect(out).toEqual([
      { at: "t1", xlm: 3 },
      { at: "t3", xlm: 2 },
    ]);
  });
});

describe("agentScorecard", () => {
  it("counts payments, totals xlm, tracks the last timestamp", () => {
    const s = agentScorecard([ev("paid", "t1", 3), ev("paid", "t2", 2), ev("escrowed", "t3", 5)]);
    expect(s).toEqual({ payments: 2, totalXlm: 5, lastAt: "t2" });
  });

  it("handles no payments", () => {
    expect(agentScorecard([ev("attested", "t1")])).toEqual({ payments: 0, totalXlm: 0, lastAt: null });
  });
});

describe("monitor", () => {
  beforeEach(() => resetMonitor());

  it("tracks errors and violations per treasury with the last error message", () => {
    trackError("C1", "boom");
    trackViolation("C1");
    trackViolation("C1");
    expect(getMonitor("C1")).toEqual({ errors: 1, violations: 2, lastError: "boom" });
  });

  it("isolates counters between treasuries", () => {
    trackViolation("C1");
    trackError("C2", "x");
    expect(getMonitor("C1")).toEqual({ errors: 0, violations: 1, lastError: null });
    expect(getMonitor("C2")).toEqual({ errors: 1, violations: 0, lastError: "x" });
  });

  it("returns a zeroed snapshot for an untouched treasury", () => {
    expect(getMonitor("CNONE")).toEqual({ errors: 0, violations: 0, lastError: null });
  });

  it("resetMonitor(id) clears only that treasury", () => {
    trackViolation("C1");
    trackViolation("C2");
    resetMonitor("C1");
    expect(getMonitor("C1").violations).toBe(0);
    expect(getMonitor("C2").violations).toBe(1);
  });

  it("resetMonitor() with no argument clears all treasuries", () => {
    trackViolation("C1");
    trackViolation("C2");
    resetMonitor();
    expect(getMonitor("C1").violations).toBe(0);
    expect(getMonitor("C2").violations).toBe(0);
  });

  it("getMonitor returns a snapshot, not a live reference", () => {
    trackViolation("C1");
    const snap = getMonitor("C1");
    snap.violations = 99;
    expect(getMonitor("C1").violations).toBe(1);
  });
});
