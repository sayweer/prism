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
// Persisted to localStorage (when available) so a reload doesn't zero the violation
// count — rejections have no on-chain event to recover them from.

export interface MonitorState {
  errors: number;
  violations: number;
  lastError: string | null;
}

const monitors = new Map<string, MonitorState>();
const monitorKey = (id: string) => `prism_monitor:${id}`;

function monitorStore(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function persist(treasuryId: string, s: MonitorState): void {
  try {
    monitorStore()?.setItem(monitorKey(treasuryId), JSON.stringify(s));
  } catch {
    // quota/unavailable — the in-memory counters still serve this session
  }
}

function stateFor(treasuryId: string): MonitorState {
  let s = monitors.get(treasuryId);
  if (!s) {
    try {
      const raw = monitorStore()?.getItem(monitorKey(treasuryId));
      s = raw ? (JSON.parse(raw) as MonitorState) : undefined;
    } catch {
      s = undefined;
    }
    s = s && typeof s.errors === "number" ? s : { errors: 0, violations: 0, lastError: null };
    monitors.set(treasuryId, s);
  }
  return s;
}

/** Record a runtime/network error (e.g. a failed RPC or wallet error). */
export function trackError(treasuryId: string, msg: string): void {
  const s = stateFor(treasuryId);
  s.errors += 1;
  s.lastError = msg;
  persist(treasuryId, s);
}

/** Record a policy violation (a payment the contract rejected on-chain). */
export function trackViolation(treasuryId: string): void {
  const s = stateFor(treasuryId);
  s.violations += 1;
  persist(treasuryId, s);
}

/** A snapshot (copy) of the treasury's monitor — untouched treasuries read as zeroes. */
export function getMonitor(treasuryId: string): MonitorState {
  return { ...stateFor(treasuryId) };
}

/** Reset one treasury's counters, or all of them when no id is given. */
export function resetMonitor(treasuryId?: string): void {
  if (treasuryId === undefined) {
    for (const id of monitors.keys()) {
      try {
        monitorStore()?.removeItem(monitorKey(id));
      } catch {
        /* ignore */
      }
    }
    monitors.clear();
  } else {
    monitors.delete(treasuryId);
    try {
      monitorStore()?.removeItem(monitorKey(treasuryId));
    } catch {
      /* ignore */
    }
  }
}
