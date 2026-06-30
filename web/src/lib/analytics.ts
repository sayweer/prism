// Analytics + monitoring for a user's treasury. Spend metrics are derived from on-chain
// `paid` events; rejections and runtime errors don't emit events, so they're tracked
// client-side in a small in-memory monitor for the analytics panel.
import type { FeedEvent } from "./events";

export interface SpendPoint {
  at: string;
  xlm: number;
}

/** The XLM-spend timeline (one point per direct payment). */
export function spendSeries(events: FeedEvent[]): SpendPoint[] {
  return events.filter((e) => e.kind === "paid").map((e) => ({ at: e.at, xlm: e.amountXlm ?? 0 }));
}

export interface Scorecard {
  payments: number;
  totalXlm: number;
  lastAt: string | null;
}

/** Payment count, total XLM spent, and the last payment's timestamp. */
export function agentScorecard(events: FeedEvent[]): Scorecard {
  const paid = events.filter((e) => e.kind === "paid");
  return {
    payments: paid.length,
    totalXlm: paid.reduce((sum, e) => sum + (e.amountXlm ?? 0), 0),
    lastAt: paid.length ? paid[paid.length - 1].at : null,
  };
}

// ---- client-side monitor (errors + policy violations are not on-chain events) ----
let errorCount = 0;
let violationCount = 0;
let lastError: string | null = null;

/** Record a runtime/network error (e.g. a failed RPC or wallet error). */
export function trackError(msg: string): void {
  errorCount += 1;
  lastError = msg;
}

/** Record a policy violation (a payment the contract rejected on-chain). */
export function trackViolation(): void {
  violationCount += 1;
}

export function getMonitor(): { errors: number; violations: number; lastError: string | null } {
  return { errors: errorCount, violations: violationCount, lastError };
}

export function resetMonitor(): void {
  errorCount = 0;
  violationCount = 0;
  lastError = null;
}
