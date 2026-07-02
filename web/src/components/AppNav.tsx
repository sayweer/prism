// Global app nav for the inner views — brand on the left, view tabs in the middle,
// and the wallet connection as a dedicated chip on the right (web3 convention: the
// connection is session state, not a view, so it never sits between the tabs).
import WalletChip from "./WalletChip";
import "./appnav.css";

export type AppView = "landing" | "dashboard" | "wallet" | "activity" | "workspace";

const TABS: { view: AppView; label: string; cls?: string }[] = [
  { view: "workspace", label: "My Prism" },
  { view: "dashboard", label: "Demo" },
  { view: "wallet", label: "Wallet", cls: "anav__tab--wallet" },
  { view: "activity", label: "Activity" },
];

export default function AppNav({ view, onGo }: { view: AppView; onGo: (v: AppView) => void }) {
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

      <WalletChip onWalletView={() => onGo("wallet")} />
    </nav>
  );
}
