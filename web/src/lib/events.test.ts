import { describe, it, expect } from "vitest";
import { bytesToInt, cursorLedger, dedupeById, formatEvent, pageToHead, type FeedEvent } from "./events";

describe("formatEvent", () => {
  it("formats a treasury 'paid' event", () => {
    const r = formatEvent(["paid", 101n], ["GVENDOR", 50000000n]);
    expect(r.kind).toBe("paid");
    expect(r.label).toMatch(/Agent paid/);
  });

  it("formats an 'attested' event, decoding the 32-byte periodId", () => {
    const period = new Uint8Array(32);
    period[31] = 2; // big-endian 2
    const r = formatEvent(["attested"], [new Uint8Array(32), period]);
    expect(r.kind).toBe("attested");
    expect(r.label).toMatch(/period 2/);
  });
});

describe("bytesToInt", () => {
  it("reads a 32-byte big-endian value", () => {
    const b = new Uint8Array(32);
    b[31] = 7;
    expect(bytesToInt(b)).toBe("7");
  });
});

// --- paging to head (Analytics truncation fix) -----------------------------------

const fe = (id: string): FeedEvent => ({ id, kind: "paid", label: "", txHash: "h", at: id });
/** A getEvents paging cursor whose TOID points at `ledger`. */
const cursorAt = (ledger: number, idx = 0) => `${(BigInt(ledger) << 32n).toString()}-${idx}`;

describe("cursorLedger", () => {
  it("parses the ledger from a TOID cursor", () => {
    expect(cursorLedger(cursorAt(954210))).toBe(954210);
    // tx/op bits set in the low 32 bits don't change the ledger part
    expect(cursorLedger(((954210n << 32n) | 4096n).toString() + "-0")).toBe(954210);
  });
  it("returns 0 for empty or malformed cursors", () => {
    expect(cursorLedger("")).toBe(0);
    expect(cursorLedger("abc-0")).toBe(0);
  });
});

describe("pageToHead", () => {
  const page = (events: FeedEvent[], cursor: string, latestLedger: number) =>
    ({ events, cursor, latestLedger });

  it("pages until the cursor passes latestLedger and keeps the newest events", async () => {
    const pages = [
      page([fe("a")], cursorAt(100), 300),
      page([fe("b")], cursorAt(200), 300),
      page([fe("c")], cursorAt(301), 300), // past head → stop
    ];
    let calls = 0;
    const out = await pageToHead(async () => pages[calls++]);
    expect(calls).toBe(3);
    expect(out.events.map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(out.truncated).toBe(false);
    expect(out.cursor).toBe(cursorAt(301));
  });

  it("continues through an empty page that is not yet at head", async () => {
    const pages = [
      page([fe("a")], cursorAt(100), 300),
      page([], cursorAt(200), 300), // quiet scan window — NOT the head
      page([fe("z")], cursorAt(301), 300),
    ];
    let calls = 0;
    const out = await pageToHead(async () => pages[calls++]);
    expect(calls).toBe(3);
    expect(out.events.map((e) => e.id)).toEqual(["a", "z"]);
  });

  it("stops at maxPages and reports truncation", async () => {
    let calls = 0;
    const out = await pageToHead(async () => {
      calls++;
      return page([fe(`e${calls}`)], cursorAt(calls), 1_000_000);
    }, 5);
    expect(calls).toBe(5);
    expect(out.truncated).toBe(true);
    expect(out.events).toHaveLength(5);
  });

  it("makes a single call when the first page already reaches head", async () => {
    let calls = 0;
    const out = await pageToHead(async () => {
      calls++;
      return page([fe("only")], cursorAt(500), 400);
    });
    expect(calls).toBe(1);
    expect(out.truncated).toBe(false);
  });

  it("passes no cursor on the first call, then the previous page's cursor", async () => {
    const seen: Array<string | undefined> = [];
    const pages = [page([], cursorAt(10), 30), page([], cursorAt(20), 30), page([], cursorAt(31), 30)];
    let calls = 0;
    await pageToHead(async (c) => {
      seen.push(c);
      return pages[calls++];
    });
    expect(seen).toEqual([undefined, cursorAt(10), cursorAt(20)]);
  });
});

describe("dedupeById", () => {
  it("drops duplicate ids preserving first-occurrence order", () => {
    const out = dedupeById([fe("a"), fe("b"), fe("a"), fe("c"), fe("b")]);
    expect(out.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });
});
