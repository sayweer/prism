import { useEffect, useState } from "react";
import {
  submitFeedback,
  type FeedbackInput,
  type ValuableFeature,
  type WouldUse,
} from "../lib/feedback";

const FEATURES: { id: ValuableFeature; label: string }[] = [
  { id: "bounded", label: "Bounded limits" },
  { id: "confidential_zk", label: "Confidential ZK" },
  { id: "x402", label: "x402" },
  { id: "escrow_reputation", label: "Escrow / reputation" },
];
const USE: { id: WouldUse; label: string }[] = [
  { id: "yes", label: "Yes" },
  { id: "maybe", label: "Maybe" },
  { id: "no", label: "No" },
];

export default function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [feature, setFeature] = useState<ValuableFeature | null>(null);
  const [improve, setImprove] = useState("");
  const [use, setUse] = useState<WouldUse | null>(null);
  const [handle, setHandle] = useState("");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Auto-fill the connected wallet (bridged from Wallet.tsx via sessionStorage).
  useEffect(() => {
    if (open) setWallet(sessionStorage.getItem("prism_wallet_address") || "");
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const input: FeedbackInput = {
      rating,
      valuableFeature: feature as ValuableFeature,
      improvementText: improve,
      wouldUseProduction: use as WouldUse,
      handle: handle || undefined,
      walletAddress: wallet || undefined,
    };
    const res = await submitFeedback(input);
    setBusy(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <div style={head}>
          <h2 style={title}>{done ? "Thank you" : "Share feedback"}</h2>
          <button style={close} onClick={onClose} aria-label="Close">×</button>
        </div>

        {done ? (
          <p style={muted}>Your feedback was recorded — it directly shapes where Prism goes next.</p>
        ) : (
          <>
            <Field label="Overall rating">
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    style={pill(rating === n)}
                    onClick={() => setRating(n)}
                    type="button"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Most valuable feature">
              <div style={wrapRow}>
                {FEATURES.map((f) => (
                  <button key={f.id} style={pill(feature === f.id)} onClick={() => setFeature(f.id)} type="button">
                    {f.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="What should we improve or add?">
              <textarea
                style={textarea}
                rows={3}
                maxLength={2000}
                placeholder="The one thing that would make this more useful…"
                value={improve}
                onChange={(e) => setImprove(e.target.value)}
              />
            </Field>

            <Field label="Would you use this in production?">
              <div style={{ display: "flex", gap: 8 }}>
                {USE.map((u) => (
                  <button key={u.id} style={pill(use === u.id)} onClick={() => setUse(u.id)} type="button">
                    {u.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Name / handle (optional)">
              <input style={input} placeholder="@you on Discord or X" value={handle} onChange={(e) => setHandle(e.target.value)} />
            </Field>

            <Field label="Wallet (optional)">
              <input style={input} placeholder="G… (auto-filled if connected)" value={wallet} onChange={(e) => setWallet(e.target.value)} />
            </Field>

            {error && <div style={errorBox}>{error}</div>}

            <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={submit} disabled={busy} type="button">
              {busy ? "Sending…" : "Send feedback"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={fieldLabel}>{label}</div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 2000, display: "grid", placeItems: "center",
  padding: 20, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
};
const card: React.CSSProperties = {
  width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", padding: 26, borderRadius: 18,
  background: "rgba(18,18,28,0.96)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4",
};
const head: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const title: React.CSSProperties = { margin: 0, fontSize: 22, fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 };
const close: React.CSSProperties = { background: "none", border: "none", color: "#A0A0B8", fontSize: 24, cursor: "pointer", lineHeight: 1 };
const muted: React.CSSProperties = { color: "#A0A0B8", marginTop: 14, fontSize: 14, lineHeight: 1.5 };
const fieldLabel: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C7C92" };
const wrapRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8 };
const pill = (active: boolean): React.CSSProperties => ({
  padding: "8px 14px", borderRadius: 999, cursor: "pointer", fontSize: 13, fontWeight: 600,
  border: active ? "1px solid #FDDA24" : "1px solid rgba(255,255,255,0.14)",
  background: active ? "rgba(253,218,36,0.14)" : "transparent",
  color: active ? "#FDDA24" : "#C7C7D2",
});
const textarea: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 10, resize: "vertical",
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4", fontSize: 14,
  fontFamily: "'Inter', system-ui, sans-serif",
};
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 10,
  background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#EDEDF4", fontSize: 14,
};
const errorBox: React.CSSProperties = { marginTop: 14, padding: "10px 13px", borderRadius: 10, border: "1px solid #FF5D5D44", color: "#FF5D5D", fontSize: 13.5 };
const primaryBtn: React.CSSProperties = {
  width: "100%", marginTop: 20, padding: "12px 16px", borderRadius: 11, border: "none", cursor: "pointer",
  background: "#FDDA24", color: "#0F0F0F", fontWeight: 600, fontSize: 15,
};
