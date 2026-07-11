// Analytics + monitoring panel for the connected treasury: payment count, total spent,
// policy violations, runtime errors, and a small spend sparkline — derived from the
// treasury's on-chain `paid` events + the client-side monitor.
import { useEffect, useRef, useState } from "react";
import { rpc } from "@stellar/stellar-sdk";
import { RPC_URL } from "../config";
import { dedupeById, fetchAllEvents, type FeedEvent } from "../lib/events";
import { agentScorecard, getMonitor, spendSeries } from "../lib/analytics";
import { loadLedger, recordEvents } from "../lib/eventLedger";

export default function Analytics({ contractId, refreshKey = 0 }: { contractId: string; refreshKey?: number }) {
  // Seed from the persistent ledger so payments older than the RPC's event-retention
  // window (which a fresh scan can no longer see) never drop out of the counters.
  const [events, setEvents] = useState<FeedEvent[]>(() => loadLedger(contractId));
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [tick, setTick] = useState(0);
  // Last read's paging cursor + events, so a refresh continues from where the previous
  // read stopped (typically one RPC round-trip) instead of re-scanning all history.
  const cacheRef = useRef<{ contractId: string; cursor: string; events: FeedEvent[] } | null>(null);

  // Re-fetch on contract change, after a parent action (refreshKey), or manual ↻ (tick).
  // RPC indexes a new payment a few seconds after it lands, so the manual refresh covers
  // the lag where an auto-refresh fires before the event is queryable.
  useEffect(() => {
    let alive = true;
    setState("loading");
    setEvents(loadLedger(contractId)); // instant paint from the ledger while the scan runs
    (async () => {
      const server = new rpc.Server(RPC_URL);

      // Incremental: continue from the cached cursor.
      const cached = cacheRef.current;
      if (cached?.contractId === contractId && cached.cursor) {
        try {
          const page = await fetchAllEvents(server, { contractIds: [contractId], cursor: cached.cursor });
          const merged = dedupeById([...cached.events, ...page.events]);
          cacheRef.current = { contractId, cursor: page.cursor || cached.cursor, events: merged };
          if (page.truncated) console.warn("Analytics: event history truncated at the page cap — totals may be partial.");
          if (alive) {
            setEvents(recordEvents(contractId, merged));
            setState("ready");
          }
          return;
        } catch {
          cacheRef.current = null; // stale/expired cursor — fall back to a cold load
        }
      }

      try {
        // Cold load: the treasury's WHOLE retained history, not a half-day window —
        // otherwise a user returning a day later sees zeroed analytics. Start at the
        // RPC's oldest retained ledger and page to the chain head (head-based stop,
        // so the NEWEST events are never dropped).
        let start = 1;
        try {
          const health = await server.getHealth();
          start = Math.max(1, (health.oldestLedger ?? 1) + 1);
        } catch {
          const latest = await server.getLatestLedger();
          start = Math.max(1, latest.sequence - 9000);
        }
        const page = await fetchAllEvents(server, { contractIds: [contractId], startLedger: start });
        cacheRef.current = { contractId, cursor: page.cursor, events: page.events };
        if (page.truncated) console.warn("Analytics: event history truncated at the page cap — totals may be partial.");
        if (alive) {
          setEvents(recordEvents(contractId, page.events));
          setState("ready");
        }
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [contractId, refreshKey, tick]);

  const score = agentScorecard(events);
  const series = spendSeries(events);
  const monitor = getMonitor(contractId);
  const max = Math.max(1, ...series.map((p) => p.xlm));

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={label}>Analytics &amp; monitoring</div>
        <button style={refreshBtn} onClick={() => setTick((t) => t + 1)} type="button">↻ Refresh</button>
      </div>
      <div style={grid}>
        <Stat label="Payments" value={String(score.payments)} />
        <Stat label="Total spent" value={`${score.totalXlm.toFixed(2)} XLM`} />
        <Stat label="Violations" value={String(monitor.violations)} danger={monitor.violations > 0} />
        <Stat label="Errors" value={String(monitor.errors)} danger={monitor.errors > 0} />
      </div>

      {series.length > 0 && (
        <>
          <div style={{ ...label, marginTop: 10 }}>Spend per payment</div>
          <div style={bars}>
            {series.slice(-12).map((p, i) => (
              <div key={i} title={`${p.xlm} XLM`} style={{ ...bar, height: `${Math.max(5, (p.xlm / max) * 42)}px` }} />
            ))}
          </div>
        </>
      )}

      <div style={{ fontSize: 11.5, color: "#7C7C92", marginTop: 8 }}>
        {state === "loading"
          ? "Reading on-chain activity…"
          : state === "error"
            ? "Couldn't reach RPC."
            : score.lastAt
              ? `Last payment ${timeAgo(score.lastAt)}`
              : "No payments yet — spend to see analytics."}
      </div>
    </div>
  );
}

function Stat({ label: l, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={statBox}>
      <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", color: "#7C7C92" }}>{l}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: danger ? "#FF5D5D" : "#EDEDF4" }}>{value}</div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 };
const statBox: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" };
const bars: React.CSSProperties = { display: "flex", alignItems: "flex-end", gap: 4, height: 48, marginTop: 6 };
// Fixed-width bars: with only a payment or two, flex-grown bars read as giant buttons.
const bar: React.CSSProperties = { width: 22, background: "#FDDA24", borderRadius: 3 };
const refreshBtn: React.CSSProperties = {
  background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "#A0A0B8",
  borderRadius: 8, padding: "4px 9px", fontSize: 11.5, cursor: "pointer",
};
