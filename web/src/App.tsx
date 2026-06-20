import { Suspense, lazy, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Background from "./components/Background";
import Landing from "./components/Landing";

// Heavy views (they pull in the large @stellar/stellar-sdk) are code-split so the
// landing loads fast — stellar-sdk only downloads when you open them.
const Dashboard = lazy(() => import("./components/Dashboard"));
const Wallet = lazy(() => import("./components/Wallet"));

type View = "landing" | "dashboard" | "wallet";

export default function App() {
  const [view, setView] = useState<View>("landing");

  const go = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <>
      <Background />

      {/* lightweight nav — switch between the agent demo and the user wallet flow */}
      <nav style={nav}>
        <button style={navBtn(view !== "wallet")} onClick={() => go("landing")}>
          Agent demo
        </button>
        <button style={navBtn(view === "wallet")} onClick={() => go("wallet")}>
          Wallet
        </button>
      </nav>

      <Suspense fallback={null}>
        <AnimatePresence mode="wait">
          {view === "wallet" ? (
            <motion.div
              key="wallet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Wallet />
            </motion.div>
          ) : view === "landing" ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
            >
              <Landing onLaunch={() => go("dashboard")} />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
            >
              <Dashboard onHome={() => go("landing")} />
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>
    </>
  );
}

const nav: React.CSSProperties = {
  position: "fixed",
  top: 16,
  right: 16,
  zIndex: 50,
  display: "flex",
  gap: 6,
  padding: 4,
  borderRadius: 12,
  background: "rgba(18,18,28,0.6)",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(8px)",
};
const navBtn = (active: boolean): React.CSSProperties => ({
  padding: "7px 13px",
  borderRadius: 9,
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  background: active ? "rgba(124,58,237,0.25)" : "transparent",
  color: active ? "#EDEDF4" : "#A0A0B8",
});
