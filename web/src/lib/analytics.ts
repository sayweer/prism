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
// Scoped per treasury so counters from one treasury never bleed into another's panel.

export interface MonitorState {
  errors: number;
  violations: number;
  lastError: string | null;
}

const monitors = new Map<string, MonitorState>();

function stateFor(treasuryId: string): MonitorState {
  let s = monitors.get(treasuryId);
  if (!s) {
    s = { errors: 0, violations: 0, lastError: null };
    monitors.set(treasuryId, s);
  }
  return s;
}

/** Record a runtime/network error (e.g. a failed RPC or wallet error). */
export function trackError(treasuryId: string, msg: string): void {
  const s = stateFor(treasuryId);
  s.errors += 1;
  s.lastError = msg;
}

/** Record a policy violation (a payment the contract rejected on-chain). */
export function trackViolation(treasuryId: string): void {
  stateFor(treasuryId).violations += 1;
}

/** A snapshot (copy) of the treasury's monitor — untouched treasuries read as zeroes. */
export function getMonitor(treasuryId: string): MonitorState {
  return { ...(monitors.get(treasuryId) ?? { errors: 0, violations: 0, lastError: null }) };
}

/** Reset one treasury's counters, or all of them when no id is given. */
export function resetMonitor(treasuryId?: string): void {
  if (treasuryId === undefined) monitors.clear();
  else monitors.delete(treasuryId);
}
