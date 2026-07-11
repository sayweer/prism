// Persistent per-treasury event ledger. The analytics panel derives its counters from
// on-chain events, but the RPC only retains a bounded ledger window — a payment older
// than that window would silently drop out of the scorecard on the next cold load.
// Every scan is merged into this localStorage-backed ledger keyed by event id, so the
// counters only ever grow. Storage is injectable so tests can pass a fake.
import type { FeedEvent } from "./events";

export interface KVStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const KEY_PREFIX = "prism_ledger:";
const keyFor = (id: string) => `${KEY_PREFIX}${id}`;
// Newest events kept per treasury — bounds localStorage growth; 500 events is far
// beyond what the sparkline (last 12) or the counters need to stay truthful.
const CAP = 500;

export function defaultStore(): KVStore | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/** Union by event id, chronologically sorted (at, then id as tiebreak) — pure. */
export function mergeLedger(stored: FeedEvent[], fresh: FeedEvent[], cap = CAP): FeedEvent[] {
  const byId = new Map<string, FeedEvent>();
  for (const e of stored) byId.set(e.id, e);
  for (const e of fresh) byId.set(e.id, e);
  const all = [...byId.values()].sort((a, b) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  return all.slice(-cap);
}

export function loadLedger(contractId: string, store: KVStore | null = defaultStore()): FeedEvent[] {
  if (!store) return [];
  try {
    const raw = store.getItem(keyFor(contractId));
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as FeedEvent[]) : [];
  } catch {
    return [];
  }
}

/** Merge freshly scanned events into the stored ledger and persist. Returns the merged
 *  view (usable even when storage is unavailable — the merge still happens in memory). */
export function recordEvents(
  contractId: string,
  fresh: FeedEvent[],
  store: KVStore | null = defaultStore(),
): FeedEvent[] {
  const merged = mergeLedger(loadLedger(contractId, store), fresh);
  if (store) {
    try {
      store.setItem(keyFor(contractId), JSON.stringify(merged));
    } catch {
      // quota exceeded — the panel still shows this session's merged view
    }
  }
  return merged;
}
