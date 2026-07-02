// Global app nav for the inner views — brand on the left, view tabs in the middle,
// and the wallet connection as a dedicated chip on the right (web3 convention: the
// connection is session state, not a view, so it never sits between the tabs).
import { useEffect, useRef, useState } from "react";
import { shortAddr } from "../config";
import {
  connect as kitConnect,
  disconnect as kitDisconnect,
  getAddress,
  onAddressChange,
} from "../lib/walletKit";
import "./appnav.css";

export type AppView = "landing" | "dashboard" | "wallet" | "activity" | "workspace";

const TABS: { view: AppView; label: string; cls?: string }[] = [
  { view: "workspace", label: "My Prism" },
  { view: "dashboard", label: "Demo" },
  { view: "wallet", label: "Wallet", cls: "anav__tab--wallet" },
  { view: "activity", label: "Activity" },
];

export default function AppNav({ view, onGo }: { view: AppView; onGo: (v: AppView) => void }) {
  const [address, setAddress] = useState<string | null>(getAddress());
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const walletRef = useRef<HTMLDivElement>(null);

  useEffect(() => onAddressChange(setAddress), []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const connect = async () => {
    try {
      await kitConnect();
    } catch {
      // User closed the wallet modal — nothing to surface here.
    }
  };

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the wallet view shows the address too.
    }
  };

  return (
    <nav className="anav">
      <button className="anav__brand" onClick={() => onGo("landing")} type="button">
        <span className="anav__glyph" />
        <span className="anav__name">Prism</span>
      </button>

      <div className="anav__tabs">
        {TABS.map((t) => (
          <button
            key={t.view}
            className={`anav__tab ${t.cls ?? ""}${view === t.view ? " is-active" : ""}`}
            onClick={() => onGo(t.view)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {!address ? (
        <button className="anav__cta" onClick={connect} type="button">
          Connect wallet
        </button>
      ) : (
        <div className="anav__wallet" ref={walletRef}>
          <button className="anav__chip" onClick={() => setMenuOpen((o) => !o)} type="button">
            <i className="anav__dot" /> {shortAddr(address)}
          </button>
          {menuOpen && (
            <div className="anav__menu">
              <button onClick={copy} type="button">
                {copied ? "Copied ✓" : "Copy address"}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onGo("wallet");
                }}
                type="button"
              >
                Wallet view
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  void kitDisconnect();
                }}
                type="button"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
