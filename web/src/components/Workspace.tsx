// The connected-user experience: connect a wallet → deploy your own bounded treasury →
// fund it → whitelist payees → spend, all signed by your wallet. The contract enforces
// the policy; rejections (#1..#4) are surfaced as "blocked by policy" — the product working.
import { useCallback, useEffect, useState } from "react";
import { connect as kitConnect, getAddress, onAddressChange, walletSignerFor } from "../lib/walletKit";
import { getTreasuryId, setTreasuryId } from "../lib/treasuryStore";
import {
  addPayee,
  adminWithdraw,
  deployTreasury,
  fundTreasury,
  isValidContractId,
  makeTreasury,
  pay,
  readLifecycle,
  readState,
  setLimits,
  setPaused,
  type Lifecycle,
  type PrismState,
} from "../lib/userTreasury";
import { EXPLORER, fmtUSDC, SERVICE, shortAddr } from "../config";
import { fundWithFriendbot, getXlmBalance, needsFunding, MIN_XLM } from "../lib/funding";
import { connectErr, errText, sendErr } from "../lib/wallet-errors";
import { trackError, trackViolation } from "../lib/analytics";
import { logActivity } from "../lib/activity";
import {
  clearSessionSecret,
  createSession,
  loadSessionSecret,
  sessionIsActive,
  sessionPay,
} from "../lib/session";
import { revokeSession } from "../lib/userTreasury";
import { parseXlmAmount } from "../lib/validate";
import { discoverTreasuries, registerTreasury } from "../lib/registry";
import Analytics from "./Analytics";

// XLM and USDC are both 7-decimal; fmtUSDC is pure math, so reuse it and label XLM.
const fmtXlm = (s: bigint) => fmtUSDC(s, 4);

type Status = { kind: "idle" | "info" | "success" | "error"; msg: string; hash?: string };

// One in-flight wallet action at a time (a wallet signs one tx at a time) — the key
// names WHICH action runs, so its button can show progress while the rest stay locked.
type Busy =
  | null
  | "deploy"
  | "fund"
  | "whitelist"
  | "spend"
  | "session"
  | "revoke"
  | "task"
  | "pause"
  | "withdraw"
  | "limits";

export default function Workspace() {
  const [address, setAddress] = useState<string | null>(getAddress());
  const [treasuryId, setTreasuryIdState] = useState<string | null>(
    getAddress() ? getTreasuryId(getAddress() as string) : null,
  );
  const [state, setState] = useState<PrismState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle", msg: "" });
  const [refreshKey, setRefreshKey] = useState(0);
  // undefined = not checked yet (or Horizon unreachable) → no gate shown; null = no account.
  const [walletXlm, setWalletXlm] = useState<number | null | undefined>(undefined);
  const [funding, setFunding] = useState(false);
  const [copied, setCopied] = useState(false);

  const [daily, setDaily] = useState("50");
  const [perTask, setPerTask] = useState("10");
  const [existing, setExisting] = useState("");
  const [fundAmt, setFundAmt] = useState("");
  const [payee, setPayee] = useState("");
  const [payTo, setPayTo] = useState("");
  const [payAmt, setPayAmt] = useState("");

  // M2 lifecycle: null while unknown OR on a pre-M2 treasury (legacy=true tells which).
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [withdrawTo, setWithdrawTo] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [newDaily, setNewDaily] = useState("");
  const [newPerTask, setNewPerTask] = useState("");

  // M2 agent session: the browser-local key (if this device started the session).
  const [sessionSecret, setSessionSecret] = useState<string | null>(null);
  const [sessionCap, setSessionCap] = useState("25");
  const [sessionHours, setSessionHours] = useState("24");

  // The single-spender rule: while a session is active, payments must be signed
  // by the session key — the wallet's signature would be rejected on-chain.
  const sessionActive = !legacy && sessionIsActive(lifecycle?.session ?? null);

  const loadState = useCallback(async (id: string, addr: string) => {
    setLoading(true);
    try {
      const t = makeTreasury(id, addr, walletSignerFor(addr));
      setState(await readState(t));
      // One probe decides v3 vs legacy: pre-M2 treasuries have no get_session/is_paused.
      const lc = await readLifecycle(t);
      setLifecycle(lc);
      setLegacy(lc === null);
      setSessionSecret(loadSessionSecret(id));
    } catch {
      setState(null);
      setLifecycle(null);
      setStatus({ kind: "error", msg: "Could not read this treasury — it may not exist on testnet." });
    } finally {
      setLoading(false);
    }
  }, []);

  // Stay in sync with the global connection (nav chip connect/disconnect). On ANY
  // address change, clear everything derived from the previous wallet — otherwise a
  // stale status message, session key, or balance can leak into the new context.
  useEffect(
    () =>
      onAddressChange((a) => {
        setAddress(a);
        setTreasuryIdState(a ? getTreasuryId(a) : null);
        setState(null);
        setLifecycle(null);
        setLegacy(false);
        setSessionSecret(null);
        setWalletXlm(undefined);
        setStatus({ kind: "idle", msg: "" });
      }),
    [],
  );

  useEffect(() => {
    if (address && treasuryId) loadState(treasuryId, address);
  }, [address, treasuryId, loadState]);

  // M2 recovery: a fresh device has no localStorage mapping — ask the on-chain
  // registry which treasuries this wallet registered and adopt the latest one.
  useEffect(() => {
    if (!address || treasuryId) return;
    let alive = true;
    (async () => {
      const found = await discoverTreasuries(address);
      if (!alive || found.length === 0) return;
      const latest = found[found.length - 1];
      setTreasuryId(address, latest);
      setTreasuryIdState(latest);
      setStatus({
        kind: "success",
        msg: `Recovered your treasury from the on-chain registry ✓ (${shortAddr(latest)})`,
      });
    })();
    return () => {
      alive = false;
    };
  }, [address, treasuryId]);

  const refreshWalletXlm = useCallback(async (addr: string) => {
    try {
      setWalletXlm(await getXlmBalance(addr));
    } catch {
      setWalletXlm(undefined);
    }
  }, []);

  useEffect(() => {
    if (address) void refreshWalletXlm(address);
  }, [address, refreshWalletXlm]);

  const friendbot = useCallback(async () => {
    if (!address) return;
    setFunding(true);
    setStatus({ kind: "info", msg: "Requesting testnet XLM from friendbot…" });
    try {
      await fundWithFriendbot(address);
      await refreshWalletXlm(address);
      setStatus({ kind: "success", msg: "Wallet funded with testnet XLM ✓" });
    } catch (e) {
      setStatus({ kind: "error", msg: errText(e) });
    } finally {
      setFunding(false);
    }
  }, [address, refreshWalletXlm]);

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
    // Validate before the wallet popup — an empty/NaN field would otherwise reach
    // toStroops(NaN) and throw an opaque "must be a non-negative number".
    const dailyLimit = parseXlmAmount(daily, "daily limit");
    if (!dailyLimit.ok) return setStatus({ kind: "error", msg: dailyLimit.msg });
    const perTaskLimit = parseXlmAmount(perTask, "per-payment limit");
    if (!perTaskLimit.ok) return setStatus({ kind: "error", msg: perTaskLimit.msg });
    // The v3 constructor rejects a self-contradicting policy on-chain — catch it
    // here first so the user gets a clear message instead of a failed deploy.
    if (perTaskLimit.value > dailyLimit.value) {
      setStatus({ kind: "error", msg: "Per-payment limit can't exceed the daily limit." });
      return;
    }
    setBusy("deploy");
    setStatus({ kind: "info", msg: "Deploying your treasury — confirm in your wallet…" });
    try {
      const id = await deployTreasury(address, walletSignerFor(address), dailyLimit.value, perTaskLimit.value);
      setTreasuryId(address, id);
      setTreasuryIdState(id);
      void logActivity({ walletAddress: address, treasuryId: id, action: "deploy" });
      // Best-effort on-chain registration (a second wallet prompt). A decline only
      // means this device's localStorage stays the sole copy of the id.
      let registered = false;
      try {
        setStatus({ kind: "info", msg: "Registering on-chain for cross-device recovery — confirm in your wallet…" });
        await registerTreasury(address, walletSignerFor(address), id);
        registered = true;
        void logActivity({ walletAddress: address, treasuryId: id, action: "register" });
      } catch {
        /* declined / RPC hiccup — the localStorage mapping still works */
      }
      setStatus({
        kind: "success",
        msg: registered
          ? "Treasury deployed ✓ and registered on-chain — recoverable from any device."
          : "Treasury deployed ✓ — on-chain registration was skipped, so your ID (above) is the only key to this treasury: copy it now.",
      });
    } catch (e) {
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, daily, perTask]);

  const useExisting = useCallback(() => {
    if (!address || !existing.trim()) return;
    const id = existing.trim();
    if (!isValidContractId(id)) {
      setStatus({
        kind: "error",
        msg: "That doesn't look like a treasury contract ID — it starts with C and is 56 characters long.",
      });
      return;
    }
    setTreasuryId(address, id);
    setTreasuryIdState(id);
    setStatus({ kind: "idle", msg: "" });
  }, [address, existing]);

  const copyId = useCallback(async () => {
    if (!treasuryId) return;
    try {
      await navigator.clipboard.writeText(treasuryId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions) — the explorer link still exposes the full id.
    }
  }, [treasuryId]);

  const fund = useCallback(async () => {
    if (!address || !treasuryId) return;
    const amt = parseXlmAmount(fundAmt);
    if (!amt.ok) return setStatus({ kind: "error", msg: amt.msg });
    setBusy("fund");
    setStatus({ kind: "info", msg: "Funding — confirm in your wallet…" });
    try {
      const hash = await fundTreasury(treasuryId, address, walletSignerFor(address), amt.value);
      void logActivity({ walletAddress: address, treasuryId, action: "fund", txHash: hash, amountXlm: amt.value });
      setStatus({ kind: "success", msg: "Funded ✓", hash });
      setFundAmt("");
      setRefreshKey((k) => k + 1);
      await loadState(treasuryId, address);
      void refreshWalletXlm(address);
    } catch (e) {
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, fundAmt, loadState, refreshWalletXlm]);

  const whitelist = useCallback(async () => {
    if (!address || !treasuryId) return;
    setBusy("whitelist");
    setStatus({ kind: "info", msg: "Whitelisting payee — confirm in your wallet…" });
    try {
      const p = payee.trim();
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      await addPayee(t, p);
      void logActivity({ walletAddress: address, treasuryId, action: "whitelist" });
      setStatus({ kind: "success", msg: `Payee whitelisted: ${shortAddr(p)} — now try a payment to it below.` });
      setPayee("");
      setPayTo(p);
    } catch (e) {
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, payee]);

  const spend = useCallback(async () => {
    if (!address || !treasuryId) return;
    const amt = parseXlmAmount(payAmt);
    if (!amt.ok) return setStatus({ kind: "error", msg: amt.msg });
    if (sessionActive && !sessionSecret) {
      setStatus({
        kind: "error",
        msg: "An agent session is active but its key isn't on this device — revoke the session below to spend with your wallet.",
      });
      return;
    }
    setBusy("spend");
    setStatus({
      kind: "info",
      msg: sessionActive ? "Sending payment — signed by the session agent…" : "Sending payment — confirm in your wallet…",
    });
    try {
      // Single-spender rule: an active session's key signs instead of the wallet.
      const res =
        sessionActive && sessionSecret
          ? await sessionPay(treasuryId, sessionSecret, BigInt(Date.now()), payTo.trim(), amt.value)
          : await pay(
              makeTreasury(treasuryId, address, walletSignerFor(address)),
              BigInt(Date.now()),
              payTo.trim(),
              amt.value,
            );
      if (res.ok) {
        void logActivity({ walletAddress: address, treasuryId, action: sessionActive ? "agent_pay" : "pay", txHash: res.hash, amountXlm: amt.value });
        setStatus({
          kind: "success",
          msg: sessionActive ? "Payment settled ✓ — signed by the session agent, no wallet popup." : "Payment settled ✓",
          hash: res.hash,
        });
        setPayAmt("");
        setRefreshKey((k) => k + 1);
      } else {
        trackViolation(treasuryId);
        void logActivity({ walletAddress: address, treasuryId, action: "reject", amountXlm: amt.value });
        setStatus({ kind: "error", msg: `Blocked by policy: ${res.errorMessage}` });
      }
      await loadState(treasuryId, address);
    } catch (e) {
      trackError(treasuryId, errText(e)); // raw message for monitoring; the classified one for the user
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, payTo, payAmt, sessionActive, sessionSecret, loadState]);

  // ---- M2 agent session -----------------------------------------------------------

  const startSession = useCallback(async () => {
    if (!address || !treasuryId) return;
    const cap = parseXlmAmount(sessionCap, "session cap");
    if (!cap.ok) return setStatus({ kind: "error", msg: cap.msg });
    const hours = parseXlmAmount(sessionHours, "duration");
    if (!hours.ok) return setStatus({ kind: "error", msg: hours.msg });
    setBusy("session");
    setStatus({ kind: "info", msg: "Starting agent session — confirm in your wallet…" });
    try {
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      const res = await createSession(t, treasuryId, cap.value, hours.value, (phase) =>
        setStatus({
          kind: "info",
          msg:
            phase === "registering"
              ? "Registering the session — confirm in your wallet…"
              : "Funding the agent's key on testnet…",
        }),
      );
      if (res.ok) {
        setSessionSecret(loadSessionSecret(treasuryId));
        void logActivity({ walletAddress: address, treasuryId, action: "session_start", txHash: res.hash });
        setStatus({
          kind: "success",
          msg: "Agent session started ✓ — payments below now sign without wallet popups.",
          hash: res.hash,
        });
        await loadState(treasuryId, address);
      } else if (res.registered) {
        // Session is live on-chain but its key couldn't be funded. Load the saved secret
        // and refresh state so the UI matches the chain (active session + revoke control).
        setSessionSecret(loadSessionSecret(treasuryId));
        void logActivity({ walletAddress: address, treasuryId, action: "session_start" });
        setStatus({
          kind: "error",
          msg: res.errorMessage ?? "Session registered but its key couldn't be funded — revoke it and start a new one.",
        });
        await loadState(treasuryId, address);
      } else {
        setStatus({ kind: "error", msg: `Blocked: ${res.errorMessage}` });
      }
    } catch (e) {
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, sessionCap, sessionHours, loadState]);

  const endSession = useCallback(async () => {
    if (!address || !treasuryId) return;
    setBusy("revoke");
    setStatus({ kind: "info", msg: "Revoking session — confirm in your wallet…" });
    try {
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      const res = await revokeSession(t);
      if (res.ok) {
        clearSessionSecret(treasuryId);
        setSessionSecret(null);
        void logActivity({ walletAddress: address, treasuryId, action: "session_revoke", txHash: res.hash });
        setStatus({ kind: "success", msg: "Session revoked ✓ — your wallet is the spender again.", hash: res.hash });
        await loadState(treasuryId, address);
      } else {
        setStatus({ kind: "error", msg: `Blocked: ${res.errorMessage}` });
      }
    } catch (e) {
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, loadState]);

  const runAutonomousTask = useCallback(async () => {
    if (!address || !treasuryId || !sessionSecret) return;
    const to = payTo.trim() || SERVICE;
    setBusy("task");
    setStatus({ kind: "info", msg: "Agent is paying autonomously — no wallet popup…" });
    try {
      const res = await sessionPay(treasuryId, sessionSecret, BigInt(Date.now()), to, 1);
      if (res.ok) {
        void logActivity({ walletAddress: address, treasuryId, action: "agent_pay", txHash: res.hash, amountXlm: 1 });
        setStatus({
          kind: "success",
          msg: `Agent paid 1 XLM to ${shortAddr(to)} autonomously ✓ — no wallet popup; the contract enforced the policy.`,
          hash: res.hash,
        });
        setRefreshKey((k) => k + 1);
      } else {
        trackViolation(treasuryId);
        void logActivity({ walletAddress: address, treasuryId, action: "reject", amountXlm: 1 });
        setStatus({ kind: "error", msg: `Blocked by policy: ${res.errorMessage}` });
      }
      await loadState(treasuryId, address);
    } catch (e) {
      trackError(treasuryId, errText(e));
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, sessionSecret, payTo, loadState]);

  // ---- M2 lifecycle controls (owner-signed; exit paths work even while paused) ----

  const togglePause = useCallback(async () => {
    if (!address || !treasuryId || !lifecycle) return;
    const next = !lifecycle.paused;
    setBusy("pause");
    setStatus({ kind: "info", msg: `${next ? "Pausing" : "Resuming"} — confirm in your wallet…` });
    try {
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      const res = await setPaused(t, next);
      if (res.ok) {
        void logActivity({ walletAddress: address, treasuryId, action: "pause" });
        setStatus({ kind: "success", msg: next ? "Treasury paused — spending is frozen." : "Treasury resumed ✓", hash: res.hash });
        await loadState(treasuryId, address);
      } else {
        setStatus({ kind: "error", msg: res.errorMessage ?? "Pause toggle failed." });
      }
    } catch (e) {
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, lifecycle, loadState]);

  const withdraw = useCallback(async () => {
    if (!address || !treasuryId) return;
    const amt = parseXlmAmount(withdrawAmt);
    if (!amt.ok) return setStatus({ kind: "error", msg: amt.msg });
    setBusy("withdraw");
    setStatus({ kind: "info", msg: "Withdrawing — confirm in your wallet…" });
    try {
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      const res = await adminWithdraw(t, withdrawTo.trim() || address, amt.value);
      if (res.ok) {
        void logActivity({ walletAddress: address, treasuryId, action: "withdraw", txHash: res.hash, amountXlm: amt.value });
        setStatus({ kind: "success", msg: "Withdrawn ✓", hash: res.hash });
        setWithdrawAmt("");
        setRefreshKey((k) => k + 1);
        await loadState(treasuryId, address);
        void refreshWalletXlm(address);
      } else {
        setStatus({ kind: "error", msg: `Blocked: ${res.errorMessage}` });
      }
    } catch (e) {
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, withdrawTo, withdrawAmt, loadState, refreshWalletXlm]);

  const updateLimits = useCallback(async () => {
    if (!address || !treasuryId) return;
    const dailyLimit = parseXlmAmount(newDaily, "daily limit");
    if (!dailyLimit.ok) return setStatus({ kind: "error", msg: dailyLimit.msg });
    const perTaskLimit = parseXlmAmount(newPerTask, "per-payment limit");
    if (!perTaskLimit.ok) return setStatus({ kind: "error", msg: perTaskLimit.msg });
    if (perTaskLimit.value > dailyLimit.value) {
      setStatus({ kind: "error", msg: "Per-payment limit can't exceed the daily limit." });
      return;
    }
    setBusy("limits");
    setStatus({ kind: "info", msg: "Updating limits — confirm in your wallet…" });
    try {
      const t = makeTreasury(treasuryId, address, walletSignerFor(address));
      const res = await setLimits(t, dailyLimit.value, perTaskLimit.value);
      if (res.ok) {
        void logActivity({ walletAddress: address, treasuryId, action: "limits" });
        setStatus({ kind: "success", msg: "Limits updated ✓ — effective immediately.", hash: res.hash });
        setNewDaily("");
        setNewPerTask("");
        await loadState(treasuryId, address);
      } else {
        setStatus({ kind: "error", msg: `Blocked: ${res.errorMessage}` });
      }
    } catch (e) {
      setStatus({ kind: "error", msg: sendErr(e) });
    } finally {
      setBusy(null);
    }
  }, [address, treasuryId, newDaily, newPerTask, loadState]);

  const statusColor =
    status.kind === "success" ? "#00FF43" : status.kind === "error" ? "#FF5D5D" : "#A0A0B8";

  return (
    <div style={wrap}>
      <div style={card}>
        <h1 style={h1}>
          <span style={{ color: "#FDDA24" }}>◭</span> Your Prism
        </h1>

        {address && walletXlm !== undefined && needsFunding(walletXlm) && (
          <div style={fundBox}>
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              {walletXlm === null
                ? "Your wallet doesn't exist on testnet yet (0 XLM)."
                : `Your wallet holds ${walletXlm.toFixed(2)} XLM on testnet.`}{" "}
              You need ~{MIN_XLM} XLM to deploy and fund a treasury — grab free testnet XLM below.
            </div>
            <button
              style={{ ...primaryBtn, opacity: funding ? 0.6 : 1 }}
              onClick={friendbot}
              disabled={funding}
            >
              {funding ? "Funding…" : "Get free testnet XLM"}
            </button>
          </div>
        )}

        {!address ? (
          <>
            <p style={sub}>Connect a Stellar wallet (testnet) to open your own bounded treasury.</p>
            <button style={primaryBtn} onClick={connect}>Connect a wallet</button>
          </>
        ) : !treasuryId ? (
          <>
            <p style={sub}>
              Connected as <span style={mono}>{shortAddr(address)}</span>. Create your treasury — you
              set the limits, the contract enforces them. Your treasury runs on{" "}
              <strong>testnet XLM</strong> (the guided demo uses test USDC).
            </p>
            <div style={label}>Daily limit (XLM)</div>
            <input style={input} inputMode="decimal" aria-label="Daily limit in XLM" value={daily} onChange={(e) => setDaily(e.target.value)} />
            <div style={label}>Per-payment limit (XLM)</div>
            <input style={input} inputMode="decimal" aria-label="Per-payment limit in XLM" value={perTask} onChange={(e) => setPerTask(e.target.value)} />
            <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={create} disabled={!!busy}>
              {busy === "deploy" ? "Deploying…" : "Create treasury"}
            </button>
            <div style={hintRow}>
              Deploying asks for <strong>two</strong> wallet approvals: ① create the treasury,
              ② register it for cross-device recovery — ② is optional; skipping it just means
              you should back up your treasury ID.
            </div>
            <div style={{ ...label, marginTop: 18 }}>Or open an existing treasury</div>
            <input style={input} placeholder="Treasury contract id (C…)" aria-label="Existing treasury contract id" value={existing} onChange={(e) => setExisting(e.target.value)} />
            <button style={ghostBtn} onClick={useExisting}>Open it</button>
          </>
        ) : (
          <>
            <div style={row}>
              <div>
                <div style={label}>Treasury</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <a style={mono} href={`${EXPLORER}/contract/${treasuryId}`} target="_blank" rel="noreferrer">
                    {shortAddr(treasuryId)} ↗
                  </a>
                  <button style={copyBtn} onClick={copyId} type="button">
                    {copied ? "Copied ✓" : "Copy ID"}
                  </button>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={label}>Owner</div>
                <div style={mono}>{shortAddr(address)}</div>
              </div>
            </div>
            {/* Persistent — critical instructions can't live only in the transient status
                slot, where the next action's message would erase them. */}
            <div style={hintRow}>
              Back up your treasury ID (Copy ID) — it reopens this treasury from any browser
              or device.
            </div>

            {loading || !state ? (
              <div style={{ ...balanceBox, color: "#A0A0B8" }}>Reading treasury…</div>
            ) : (
              <div style={balanceBox}>
                <div style={label}>Balance</div>
                <div style={{ fontSize: 28, fontWeight: 600 }}>{fmtXlm(state.balance)} XLM</div>
                <div style={{ display: "flex", gap: 18, marginTop: 10, fontSize: 13, color: "#A0A0B8" }}>
                  <span>Last 24h: {fmtXlm(state.daySpent)} / {fmtXlm(state.dailyLimit)} XLM</span>
                  <span>Per-payment ≤ {fmtXlm(state.perTaskLimit)} XLM</span>
                </div>
                {lifecycle?.paused && (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#FF5D5D" }}>
                    ⏸ Paused — spending is frozen; withdraw still works.
                  </div>
                )}
              </div>
            )}

            <Section title="Fund treasury">
              <input style={input} inputMode="decimal" placeholder="Amount (XLM)" aria-label="Fund amount in XLM" value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} />
              <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={fund} disabled={!!busy}>
                {busy === "fund" ? "Funding…" : "Fund"}
              </button>
            </Section>

            <Section title="Whitelist a payee">
              <input style={input} placeholder="Payee address (G… or C…)" aria-label="Payee address" value={payee} onChange={(e) => setPayee(e.target.value)} />
              <div style={hintRow}>
                No second address handy?{" "}
                <button style={inlineLink} type="button" onClick={() => setPayee(SERVICE)}>
                  use the sample vendor ({shortAddr(SERVICE)})
                </button>
              </div>
              <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={whitelist} disabled={!!busy}>
                {busy === "whitelist" ? "Adding…" : "Add payee"}
              </button>
            </Section>

            <Section title="Spend">
              <input style={input} placeholder="To (whitelisted address)" aria-label="Payment destination address" value={payTo} onChange={(e) => setPayTo(e.target.value)} />
              <input style={input} inputMode="decimal" placeholder="Amount (XLM)" aria-label="Payment amount in XLM" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} />
              <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={spend} disabled={!!busy}>
                {busy === "spend"
                  ? "Sending…"
                  : sessionActive
                    ? "Send payment (agent signs — no popup)"
                    : "Send payment"}
              </button>
            </Section>

            {!legacy && lifecycle && (
              <Section title="Leash — agent session">
                {sessionActive && lifecycle.session ? (
                  <>
                    <div style={hintRow}>
                      Agent {shortAddr(lifecycle.session.agent)} · cap left:{" "}
                      {fmtXlm(lifecycle.session.limit - lifecycle.session.spent)} XLM · expires{" "}
                      {new Date(Number(lifecycle.session.valid_until) * 1000).toLocaleString()}
                    </div>
                    {sessionSecret ? (
                      <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={runAutonomousTask} disabled={!!busy}>
                        {busy === "task"
                          ? "Agent paying…"
                          : `Run autonomous task (1 XLM → ${shortAddr(payTo.trim() || SERVICE)}, no popup)`}
                      </button>
                    ) : (
                      <div style={hintRow}>
                        The session key isn't on this device — revoke below and start a new
                        session to spend from here.
                      </div>
                    )}
                    <button style={{ ...ghostBtn, opacity: busy ? 0.6 : 1 }} onClick={endSession} disabled={!!busy}>
                      {busy === "revoke" ? "Revoking…" : "Revoke Leash"}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={hintRow}>
                      Hand this treasury to an autonomous agent on a Leash: a time-bound,
                      spend-capped key signs payments with no wallet popups — the contract
                      still enforces every limit.
                    </div>
                    <input style={input} inputMode="decimal" placeholder="Session cap (XLM)" aria-label="Session spending cap in XLM" value={sessionCap} onChange={(e) => setSessionCap(e.target.value)} />
                    <input style={input} inputMode="decimal" placeholder="Duration (hours)" aria-label="Session duration in hours" value={sessionHours} onChange={(e) => setSessionHours(e.target.value)} />
                    <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={startSession} disabled={!!busy}>
                      {busy === "session" ? "Starting…" : "Start Leash"}
                    </button>
                  </>
                )}
              </Section>
            )}

            {legacy ? (
              <Section title="Controls">
                <div style={hintRow}>
                  This treasury predates M2 — pause, withdraw, limit updates, and agent
                  sessions need a freshly deployed treasury.
                </div>
              </Section>
            ) : (
              lifecycle && (
                <Section title="Controls">
                  <button style={{ ...ghostBtn, opacity: busy ? 0.6 : 1 }} onClick={togglePause} disabled={!!busy}>
                    {busy === "pause" ? "Working…" : lifecycle.paused ? "Resume spending" : "Pause spending"}
                  </button>
                  <div style={{ ...label, marginTop: 12 }}>Withdraw (owner exit — works while paused)</div>
                  <input style={input} placeholder={`To (default: your wallet ${shortAddr(address)})`} aria-label="Withdraw destination address" value={withdrawTo} onChange={(e) => setWithdrawTo(e.target.value)} />
                  <input style={input} inputMode="decimal" placeholder="Amount (XLM)" aria-label="Withdraw amount in XLM" value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)} />
                  <button style={{ ...ghostBtn, opacity: busy ? 0.6 : 1 }} onClick={withdraw} disabled={!!busy}>
                    {busy === "withdraw" ? "Withdrawing…" : "Withdraw"}
                  </button>
                  <div style={{ ...label, marginTop: 12 }}>Update limits (effective immediately)</div>
                  <input style={input} inputMode="decimal" placeholder="New daily limit (XLM)" aria-label="New daily limit in XLM" value={newDaily} onChange={(e) => setNewDaily(e.target.value)} />
                  <input style={input} inputMode="decimal" placeholder="New per-payment limit (XLM)" aria-label="New per-payment limit in XLM" value={newPerTask} onChange={(e) => setNewPerTask(e.target.value)} />
                  <button style={{ ...ghostBtn, opacity: busy ? 0.6 : 1 }} onClick={updateLimits} disabled={!!busy}>
                    {busy === "limits" ? "Updating…" : "Update limits"}
                  </button>
                </Section>
              )
            )}

            <Analytics contractId={treasuryId} refreshKey={refreshKey} />
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

// Top padding clears the fixed app nav on phones (the card can reach the viewport top).
const wrap: React.CSSProperties = { minHeight: "100vh", display: "grid", placeItems: "center", padding: "84px 16px 24px" };
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
const fundBox: React.CSSProperties = {
  marginTop: 16, padding: 14, borderRadius: 12,
  background: "rgba(253,218,36,0.07)", border: "1px solid rgba(253,218,36,0.35)", color: "#EDEDF4",
};
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", marginTop: 8, padding: "11px 13px", borderRadius: 10,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4", fontSize: 14,
};
const primaryBtn: React.CSSProperties = {
  width: "100%", marginTop: 12, padding: "12px 16px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "#FDDA24", color: "#0F0F0F", fontWeight: 600, fontSize: 15,
};
const hintRow: React.CSSProperties = { marginTop: 6, fontSize: 12, color: "#7C7C92" };
const inlineLink: React.CSSProperties = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  color: "#A0A0B8", textDecoration: "underline", font: "inherit", fontSize: 12,
};
const copyBtn: React.CSSProperties = {
  padding: "3px 9px", borderRadius: 7, fontSize: 11.5, cursor: "pointer",
  background: "transparent", border: "1px solid rgba(255,255,255,0.18)", color: "#A0A0B8",
};
const ghostBtn: React.CSSProperties = {
  width: "100%", marginTop: 8, padding: "10px 14px", borderRadius: 10, cursor: "pointer", fontSize: 14,
  background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#A0A0B8",
};
const statusBox: React.CSSProperties = { marginTop: 18, padding: "10px 13px", borderRadius: 10, border: "1px solid", fontSize: 13.5, lineHeight: 1.4 };
