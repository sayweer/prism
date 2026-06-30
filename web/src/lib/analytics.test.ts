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

  it("tracks errors and violations with the last error message", () => {
    trackError("boom");
    trackViolation();
    trackViolation();
    expect(getMonitor()).toEqual({ errors: 1, violations: 2, lastError: "boom" });
  });
});
