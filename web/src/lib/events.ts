// Real-time contract event synchronisation (Level 2). Soroban has no push stream, so
// we cursor-poll the RPC's getEvents for the treasury + verifier and surface them as a
// live activity feed.
import { rpc, scValToNative } from "@stellar/stellar-sdk";
import { TREASURY_ID, VERIFIER_ID } from "../config";

const WATCHED = [TREASURY_ID, VERIFIER_ID];

export interface FeedEvent {
  id: string;
  kind: string; // topic symbol: paid / attested / escrowed / released / refunded
  label: string; // human summary
  txHash: string;
  at: string; // ISO timestamp (ledgerClosedAt)
}

const short = (s: unknown) => {
  const a = String(s);
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
};
const xlm = (v: unknown) => (Number(v) / 1e7).toLocaleString(undefined, { maximumFractionDigits: 4 });
// 32-byte big-endian field element (e.g. periodId) -> its integer value.
const bytesToInt = (b: unknown): string => {
  if (b instanceof Uint8Array) {
    let n = 0n;
    for (const x of b) n = (n << 8n) | BigInt(x);
    return n.toString();
  }
  return String(b ?? "");
};

/** Pure formatter: decoded topic symbols + data -> a human label. Testable in isolation. */
export function formatEvent(topics: unknown[], data: unknown): { kind: string; label: string } {
  const kind = String(topics[0] ?? "event");
  const d = data as unknown[];
  switch (kind) {
    case "paid":
      return { kind, label: `Agent paid ${xlm(d?.[1])} XLM to ${short(d?.[0])} · task ${topics[1]}` };
    case "attested":
      return { kind, label: `ZK compliance attested · period ${bytesToInt(d?.[1])}` };
    case "escrowed":
      return { kind, label: `Escrow #${topics[1]} opened · ${xlm(d?.[1])} XLM for ${short(d?.[0])}` };
    case "released":
      return { kind, label: `Escrow #${topics[1]} released to ${short(d?.[0])}` };
    case "refunded":
      return { kind, label: `Escrow #${topics[1]} refunded` };
    default:
      return { kind, label: kind };
  }
}

/** One page of getEvents, decoded into feed items. Pass either startLedger or a cursor. */
export async function fetchEventsPage(
  server: rpc.Server,
  opts: { startLedger?: number; cursor?: string },
): Promise<{ events: FeedEvent[]; cursor: string }> {
  const filters = [{ type: "contract" as const, contractIds: WATCHED }];
  const res = await server.getEvents(
    opts.cursor ? { cursor: opts.cursor, filters } : { startLedger: opts.startLedger ?? 0, filters },
  );

  const events = res.events.map((e): FeedEvent => {
    const topics = e.topic.map((t) => scValToNative(t));
    const data = scValToNative(e.value);
    const { kind, label } = formatEvent(topics, data);
    return { id: e.id, kind, label, txHash: e.txHash, at: e.ledgerClosedAt };
  });
  return { events, cursor: (res as { cursor?: string }).cursor ?? "" };
}
