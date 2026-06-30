// The connected-user experience: connect a wallet → deploy your own bounded treasury →
// fund it → whitelist payees → spend, all signed by your wallet. The contract enforces
// the policy; rejections (#1..#4) are surfaced as "blocked by policy" — the product working.
import { useCallback, useEffect, useState } from "react";
import { connect as kitConnect, getAddress, walletSignerFor } from "../lib/walletKit";
import { getTreasuryId, setTreasuryId } from "../lib/treasuryStore";
import {
  addPayee,
  deployTreasury,
  fundTreasury,
  makeTreasury,
  pay,
  readState,
  type PrismState,
} from "../lib/userTreasury";
import { EXPLORER, fmtUSDC, shortAddr } from "../config";
import { connectErr } from "../lib/wallet-errors";

// XLM and USDC are both 7-decimal; fmtUSDC is pure math, so reuse it and label XLM.
const fmtXlm = (s: bigint) => fmtUSDC(s, 4);
const errText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "Something went wrong.";

type Status = { kind: "idle" | "info" | "success" | "error"; msg: string; hash?: string };

export default function Workspace() {
  const [address, setAddress] = useState<string | null>(getAddress());
  const [treasuryId, setTreasuryIdState] = useState<string | null>(
    getAddress() ? getTreasuryId(getAddress() as string) : null,
  );
  const [state, setState] = useState<PrismState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle", msg: "" });

  const [daily, setDaily] = useState("50");
  const [perTask, setPerTask] = useState("10");
  const [existing, setExisting] = useState("");
  const [fundAmt, setFundAmt] = useState("");
  const [payee, setPayee] = useState("");
  const [payTo, setPayTo] = useState("");
  const [payAmt, setPayAmt] = useState("");

  const loadState = useCallback(async (id: string, addr: string) => {
    setLoading(true);
    try {
      const t = makeTreasury(id, addr, walletSignerFor(addr));
      setState(await readState(t));
    } catch {
      setState(null);
      setStatus({ kind: "error", msg: "Could not read this treasury — it may not exist on testnet." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address && treasuryId) loadState(treasuryId, address);
  }, [address, treasuryId, loadState]);

  const connect = useCallback(async () => {
    try {
      const addr = await kitConnect();
      setAddress(addr);
      setTreasuryIdState(getTreasuryId(addr));
      setStatus({ kind: "idle", msg: "" });
    } catch (e) {
      setStatus({ kind: "error", msg: connectErr(e) });
    }
  }, []);

  const create = useCallback(async () => {
    if (!address) return;
    setBusy(true);
    setStatus({ kind: "info", msg: "Deploying your treasury — confirm in your wallet…" });
    try {
      const id = await deployTreasury(address, walletSignerFor(address), Number(daily), Number(perTask));
      setTreasuryId(address, id);
      setTreasuryIdState(id);
      setStatus({ kind: "success", msg: `Treasury deployed: ${shortAddr(id)}` });
    } catch (e) {
      setStatus({ kind: "error", msg: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [address, daily, perTask]);

  const useExisting = useCallback(() => {
    if (!address || !existing.trim()) return;
    setTreasuryId(address, existing.trim());
    setTreasuryIdState(existing.trim());
  }, [address, existing]);

  const fund = useCallback(async () => {
    if (!address || !treasuryId) return;
    setBusy(true);
    setStatus({ kind: "info", msg: "Funding — confirm in your wallet…" });
    try {
      const hash = await fundTreasury(treasuryId, address, walletSignerFor(address), Number(fundAmt));
      setStatus({ kind: "success", msg: "Funded ✓", hash });
      setFundAmt("");
      await loadState(treasuryId, address);
    } catch (e) {
      setStatus({ kind: "error", msg: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [address, treasuryId, fundAmt, loadState]);

  const whitelist = useCallback(async () => {
    if (!address || !treasuryId) return;
    setBusy(true);
    setStatus({ kind: "info", msg: "Whitelisting payee — confirm in your wallet…" });
    try {
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      await addPayee(t, payee.trim());
      setStatus({ kind: "success", msg: `Payee whitelisted: ${shortAddr(payee.trim())}` });
      setPayee("");
    } catch (e) {
      setStatus({ kind: "error", msg: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [address, treasuryId, payee]);

  const spend = useCallback(async () => {
    if (!address || !treasuryId) return;
    setBusy(true);
    setStatus({ kind: "info", msg: "Sending payment — confirm in your wallet…" });
    try {
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      const res = await pay(t, BigInt(Date.now()), payTo.trim(), Number(payAmt));
      if (res.ok) {
        setStatus({ kind: "success", msg: "Payment settled ✓", hash: res.hash });
        setPayAmt("");
      } else {
        setStatus({ kind: "error", msg: `Blocked by policy: ${res.errorMessage}` });
      }
      await loadState(treasuryId, address);
    } catch (e) {
      setStatus({ kind: "error", msg: errText(e) });
    } finally {
      setBusy(false);
    }
  }, [address, treasuryId, payTo, payAmt, loadState]);

  const statusColor =
    status.kind === "success" ? "#00FF43" : status.kind === "error" ? "#FF5D5D" : "#A0A0B8";

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={h1}>
          <span style={{ color: "#FDDA24" }}>◭</span> Your Prism
        </h1>

        {!address ? (
          <>
            <p style={sub}>Connect a Stellar wallet (testnet) to open your own bounded treasury.</p>
            <button style={primaryBtn} onClick={connect}>Connect a wallet</button>
          </>
        ) : !treasuryId ? (
          <>
            <p style={sub}>
              Connected as <span style={mono}>{shortAddr(address)}</span>. Create your treasury — you
              set the limits, the contract enforces them.
            </p>
            <div style={label}>Daily limit (XLM)</div>
            <input style={input} inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />
            <div style={label}>Per-payment limit (XLM)</div>
            <input style={input} inputMode="decimal" value={perTask} onChange={(e) => setPerTask(e.target.value)} />
            <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={create} disabled={busy}>
              {busy ? "Deploying…" : "Create treasury"}
            </button>
            <div style={{ ...label, marginTop: 18 }}>Or open an existing treasury</div>
            <input style={input} placeholder="Treasury contract id (C…)" value={existing} onChange={(e) => setExisting(e.target.value)} />
            <button style={ghostBtn} onClick={useExisting}>Open it</button>
          </>
        ) : (
          <>
            <div style={row}>
              <div>
                <div style={label}>Treasury</div>
                <a style={mono} href={`${EXPLORER}/contract/${treasuryId}`} target="_blank" rel="noreferrer">
                  {shortAddr(treasuryId)} ↗
                </a>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={label}>Owner</div>
                <div style={mono}>{shortAddr(address)}</div>
              </div>
            </div>

            {loading || !state ? (
              <div style={{ ...balanceBox, color: "#A0A0B8" }}>Reading treasury…</div>
            ) : (
              <div style={balanceBox}>
                <div style={label}>Balance</div>
                <div style={{ fontSize: 28, fontWeight: 600 }}>{fmtXlm(state.balance)} XLM</div>
                <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 13, color: "#A0A0B8" }}>
                  <span>Today: {fmtXlm(state.daySpent)} / {fmtXlm(state.dailyLimit)} XLM</span>
                  <span>Per-payment ≤ {fmtXlm(state.perTaskLimit)} XLM</span>
                </div>
              </div>
            )}

            <Section title="Fund treasury">
              <input style={input} inputMode="decimal" placeholder="Amount (XLM)" value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} />
              <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={fund} disabled={busy}>Fund</button>
            </Section>

            <Section title="Whitelist a payee">
              <input style={input} placeholder="Payee address (G… or C…)" value={payee} onChange={(e) => setPayee(e.target.value)} />
              <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={whitelist} disabled={busy}>Add payee</button>
            </Section>

            <Section title="Spend">
              <input style={input} placeholder="To (whitelisted address)" value={payTo} onChange={(e) => setPayTo(e.target.value)} />
              <input style={input} inputMode="decimal" placeholder="Amount (XLM)" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
              <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={spend} disabled={busy}>Send payment</button>
            </Section>
          </>
        )}

        {status.msg && (
          <div style={{ ...statusBox, color: statusColor, borderColor: statusColor + "44" }}>
            {status.msg}
            {status.hash && (
              <>
                {" "}
                <a style={{ color: statusColor }} href={`${EXPLORER}/tx/${status.hash}`} target="_blank" rel="noreferrer">
                  view tx ↗
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={label}>{title}</div>
      {children}
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 };
const card: React.CSSProperties = {
  width: "100%", maxWidth: 480, padding: 28, borderRadius: 18,
  background: "rgba(18,18,28,0.72)", border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(12px)", color: "#EDEDF4",
};
const h1: React.CSSProperties = { margin: 0, fontSize: 27, letterSpacing: "-0.02em", fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 };
const sub: React.CSSProperties = { color: "#A0A0B8", marginTop: 6, fontSize: 14, lineHeight: 1.5 };
const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92", marginTop: 6 };
const mono: React.CSSProperties = { fontFamily: "ui-monospace, monospace", fontSize: 14, color: "#EDEDF4", textDecoration: "none" };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 };
const balanceBox: React.CSSProperties = { marginTop: 16, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)" };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 8, padding: "11px 13px", borderRadius: 10,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4", fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  width: "100%", marginTop: 12, padding: "12px 16px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "#FDDA24", color: "#0F0F0F", fontWeight: 600, fontSize: 15,
};
const ghostBtn: React.CSSProperties = {
  width: "100%", marginTop: 8, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14,
  background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#A0A0B8",
};
const statusBox: React.CSSProperties = { marginTop: 18, padding: "10px 13px", borderRadius: 10, border: "1px solid", fontSize: 13.5, lineHeight: 1.4 };
