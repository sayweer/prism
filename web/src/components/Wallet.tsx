// Level 2 — multi-wallet via StellarWalletsKit. The connect button opens a modal of
// wallet options (Freighter / xBull / Albedo / Lobstr / Rabet / Hana); then show the
// testnet XLM balance and send an XLM payment with success/failure + tx-hash feedback.
// Three error types are surfaced: wallet not installed, request rejected, insufficient
// balance. (Premium visual pass is a later phase with Gemini; this is the functional layer.)
import { useCallback, useEffect, useState } from "react";
import { Asset, BASE_FEE, Horizon, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { EXPLORER, HORIZON_URL, NETWORK_PASSPHRASE, shortAddr } from "../config";
import { connectErr, sendErr } from "../lib/wallet-errors";
import { kit, connect as kitConnect, disconnect as kitDisconnect, getAddress, onAddressChange } from "../lib/walletKit";

const server = new Horizon.Server(HORIZON_URL);

type Status = { kind: "idle" | "info" | "success" | "error"; msg: string; hash?: string };

export default function Wallet() {
  // Hydrate from the shared kit state — a wallet connected in the Workspace (or before
  // a reload) is the same session-wide connection, so show it here too.
  const [address, setAddress] = useState<string | null>(getAddress());
  const [balance, setBalance] = useState<string | null>(null);
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle", msg: "" });
  const [busy, setBusy] = useState(false);

  const loadBalance = useCallback(async (addr: string) => {
    try {
      const acct = await server.loadAccount(addr);
      const native = acct.balances.find((b) => b.asset_type === "native");
      setBalance(native ? native.balance : "0");
    } catch {
      setBalance("0"); // account not yet funded on testnet
    }
  }, []);

  useEffect(() => {
    if (address) void loadBalance(address);
  }, [address, loadBalance]);

  // Stay in sync with the global connection (nav chip connect/disconnect).
  useEffect(
    () =>
      onAddressChange((a) => {
        setAddress(a);
        if (!a) setBalance(null);
      }),
    [],
  );

  const connect = useCallback(async () => {
    setStatus({ kind: "info", msg: "Choose a wallet…" });
    try {
      const addr = await kitConnect();
      setAddress(addr);
      setStatus({ kind: "idle", msg: "" });
      await loadBalance(addr);
    } catch (e) {
      setStatus({ kind: "error", msg: connectErr(e) });
    }
  }, [loadBalance]);

  const disconnect = useCallback(async () => {
    await kitDisconnect();
    setAddress(null);
    setBalance(null);
    setDest("");
    setAmount("");
    setStatus({ kind: "idle", msg: "" });
  }, []);

  const send = useCallback(async () => {
    if (!address) return;
    if (!dest.trim() || !amount.trim()) {
      setStatus({ kind: "error", msg: "Enter a destination address and an amount." });
      return;
    }
    setBusy(true);
    setStatus({ kind: "info", msg: "Building transaction…" });
    try {
      const source = await server.loadAccount(address);
      const tx = new TransactionBuilder(source, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          Operation.payment({ destination: dest.trim(), asset: Asset.native(), amount: amount.trim() }),
        )
        .setTimeout(180)
        .build();

      setStatus({ kind: "info", msg: "Awaiting wallet signature…" });
      const { signedTxXdr } = await kit.signTransaction(tx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
        address,
      });

      setStatus({ kind: "info", msg: "Submitting to testnet…" });
      const toSubmit = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
      const res = await server.submitTransaction(toSubmit);
      setStatus({ kind: "success", msg: "Payment sent — confirmed on testnet ✓", hash: res.hash });
      setAmount("");
      await loadBalance(address);
    } catch (e) {
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(false);
    }
  }, [address, dest, amount, loadBalance]);

  const statusColor =
    status.kind === "success" ? "#00FF43" : status.kind === "error" ? "#FF5D5D" : "#A0A0B8";

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={{ margin: 0, fontSize: 27, letterSpacing: "-0.02em", fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>
          <span style={{ color: "#FDDA24" }}>◭</span> Wallet
        </h1>
        <p style={{ color: "#A0A0B8", marginTop: 6, fontSize: 14 }}>
          Connect any Stellar wallet, view your testnet XLM balance, and send a payment.
        </p>

        {!address ? (
          <button style={primaryBtn} onClick={connect}>
            Connect a wallet
          </button>
        ) : (
          <>
            <div style={row}>
              <div>
                <div style={label}>Connected</div>
                <div style={mono}>{shortAddr(address)}</div>
              </div>
              <button style={ghostBtn} onClick={disconnect}>
                Disconnect
              </button>
            </div>

            <div style={balanceBox}>
              <div style={label}>Balance</div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>
                {balance === null ? "…" : `${balance} XLM`}
              </div>
              <button style={linkBtn} onClick={() => loadBalance(address)}>
                ↻ Refresh
              </button>
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={label}>Send XLM (testnet)</div>
              <input
                style={input}
                placeholder="Destination address (G…)"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
              />
              <input
                style={input}
                placeholder="Amount (XLM)"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={send} disabled={busy}>
                {busy ? "Sending…" : "Send payment"}
              </button>
            </div>
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

// --- minimal functional styling (premium re-design is a later phase with Gemini) ---
const wrap: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 };
const card: React.CSSProperties = {
  width: "100%", maxWidth: 460, padding: 28, borderRadius: 18,
  background: "rgba(18,18,28,0.72)", border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(12px)", color: "#EDEDF4",
};
const label: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92" };
const mono: React.CSSProperties = { fontFamily: "ui-monospace, monospace", fontSize: 14, marginTop: 2 };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 };
const balanceBox: React.CSSProperties = { marginTop: 16, padding: 16, borderRadius: 12, background: "rgba(255,255,255,0.04)" };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 8, padding: "11px 13px", borderRadius: 10,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4", fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  width: "100%", marginTop: 16, padding: "12px 16px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "#FDDA24", color: "#0F0F0F", fontWeight: 600, fontSize: 15,
};
const ghostBtn: React.CSSProperties = {
  padding: "7px 12px", borderRadius: 9, cursor: "pointer", fontSize: 13,
  background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#A0A0B8",
};
const linkBtn: React.CSSProperties = { marginTop: 8, background: "none", border: "none", color: "#FDDA24", cursor: "pointer", fontSize: 13, padding: 0 };
const statusBox: React.CSSProperties = { marginTop: 18, padding: "10px 13px", borderRadius: 10, border: "1px solid", fontSize: 13.5, lineHeight: 1.4 };
