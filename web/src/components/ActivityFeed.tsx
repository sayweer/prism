// Level 2 — real-time event synchronization. Cursor-polls Soroban RPC and streams the
// treasury + verifier contract events into a live feed. (Premium visual pass is a later
// phase with Gemini; this is the functional layer.)
import { useEffect, useMemo, useState } from "react";
import { rpc } from "@stellar/stellar-sdk";
import { EXPLORER, RPC_URL, TREASURY_ID, VERIFIER_ID } from "../config";
import { fetchEventsPage, type FeedEvent } from "../lib/events";
import { getAddress } from "../lib/walletKit";
import { getTreasuryId } from "../lib/treasuryStore";

const POLL_MS = 6000; // ~1 testnet ledger
const MAX_ITEMS = 60;

export default function ActivityFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [state, setState] = useState<"connecting" | "live" | "error">("connecting");

  // Watch the connected user's own treasury alongside the demo treasury + verifier —
  // otherwise a user's payments never show up here and the feed looks broken.
  const contractIds = useMemo(() => {
    const addr = getAddress();
    const mine = addr ? getTreasuryId(addr) : null;
    return mine ? [TREASURY_ID, VERIFIER_ID, mine] : [TREASURY_ID, VERIFIER_ID];
  }, []);

  useEffect(() => {
    const server = new rpc.Server(RPC_URL);
    let cursor = "";
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (stopped) return;
      try {
        const page = await fetchEventsPage(server, cursor ? { cursor, contractIds } : ({ contractIds } as never));
        if (page.events.length) {
          setEvents((prev) => dedupe([...page.events.reverse(), ...prev]).slice(0, MAX_ITEMS));
        }
        if (page.cursor) cursor = page.cursor;
      } catch {
        /* transient RPC hiccup — keep polling */
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };

    (async () => {
      try {
        const latest = await server.getLatestLedger();
        const start = Math.max(1, latest.sequence - 17280); // ~last day of activity (5s ledgers)
        // getEvents scans ~10k ledgers per call, so a day-wide window spans multiple
        // pages — page through to the head up front, or the newest events (past the
        // first, often empty, page) never render and the feed looks dead.
        let page = await fetchEventsPage(server, { startLedger: start, contractIds });
        let all = page.events;
        for (let i = 0; i < 3 && page.cursor; i++) {
          page = await fetchEventsPage(server, { cursor: page.cursor, contractIds });
          all = [...all, ...page.events];
        }
        setEvents(dedupe(all.reverse()).slice(0, MAX_ITEMS));
        cursor = page.cursor;
        setState("live");
        timer = setTimeout(tick, POLL_MS);
      } catch {
        setState("error");
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [contractIds]);

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em" }}>◭ Activity</h1>
          <span style={dot(state)}>
            {state === "live" ? "● live" : state === "connecting" ? "○ connecting" : "○ offline"}
          </span>
        </div>
        <p style={{ color: "#A0A0B8", marginTop: 6, fontSize: 14 }}>
          Real-time on-chain events from the demo treasury, the ZK verifier — and your own
          treasury when your wallet is connected.
        </p>

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {events.length === 0 ? (
            <div style={{ color: "#7C7C92", fontSize: 14, padding: "20px 0" }}>
              {state === "error" ? "Couldn't reach the RPC." : "Listening for new events…"}
            </div>
          ) : (
            events.map((e) => (
              <a
                key={e.id}
                style={item}
                href={`${EXPLORER}/tx/${e.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                <span style={kindTag(e.kind)}>{e.kind}</span>
                <span style={{ flex: 1, fontSize: 13.5 }}>{e.label}</span>
                <span style={{ color: "#7C7C92", fontSize: 11.5 }}>{timeAgo(e.at)}</span>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function dedupe(list: FeedEvent[]): FeedEvent[] {
  const seen = new Set<string>();
  return list.filter((e) => (seen.has(e.id) ? false : seen.add(e.id)));
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

const wrap: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 };
const card: React.CSSProperties = {
  width: "100%", maxWidth: 560, padding: 28, borderRadius: 18,
  background: "rgba(18,18,28,0.72)", border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(12px)", color: "#EDEDF4",
};
const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
  color: "#EDEDF4", textDecoration: "none",
};
const kindTag = (kind: string): React.CSSProperties => ({
  fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700,
  padding: "3px 7px", borderRadius: 6, whiteSpace: "nowrap",
  background: kind === "attested" ? "rgba(34,211,238,0.16)" : "rgba(124,58,237,0.18)",
  color: kind === "attested" ? "#22D3EE" : "#C4A8FF",
});
const dot = (state: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 600,
  color: state === "live" ? "#00FF43" : state === "error" ? "#FF5D5D" : "#A0A0B8",
});
