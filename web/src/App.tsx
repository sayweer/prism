import { Suspense, lazy, useEffect, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Background from "./components/Background";
import Landing from "./components/Landing";
import FeedbackButton from "./components/FeedbackButton";
import { logFunnel } from "./lib/funnel";

// Heavy views (they pull in the large @stellar/stellar-sdk) are code-split so the
// landing loads fast — stellar-sdk only downloads when you open them.
// Recover from a stale lazy chunk after a deploy: an old cached index.html requests a
// chunk hash that no longer exists (404) → instead of a black screen, reload once to
// fetch the fresh index + correct chunks.
const RELOAD_AT = "prism_chunk_reload_at";
function lazyWithReload<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch(() => {
      // Reload once to fetch a fresh index, but not more than once per 10s (loop guard).
      const last = Number(sessionStorage.getItem(RELOAD_AT) || "0");
      if (Date.now() - last > 10_000) {
        sessionStorage.setItem(RELOAD_AT, String(Date.now()));
        window.location.reload();
      }
      return new Promise<{ default: T }>(() => {}); // never resolves; the page is reloading
    }),
  );
}
const Dashboard = lazyWithReload(() => import("./components/Dashboard"));
const Wallet = lazyWithReload(() => import("./components/Wallet"));
const ActivityFeed = lazyWithReload(() => import("./components/ActivityFeed"));
const Workspace = lazyWithReload(() => import("./components/Workspace"));
// AppNav pulls in the wallet kit — keep it lazy so the landing bundle stays light.
const AppNav = lazyWithReload(() => import("./components/AppNav"));

type View = "landing" | "dashboard" | "wallet" | "activity" | "workspace";

// Views live in the URL hash so a refresh (or back/forward) keeps the current view
// instead of dumping the user back on the landing page.
const VIEWS: readonly View[] = ["landing", "dashboard", "wallet", "activity", "workspace"];
const viewFromHash = (): View => {
  const h = window.location.hash.slice(1);
  return (VIEWS as readonly string[]).includes(h) ? (h as View) : "landing";
};

export default function App() {
  const [view, setView] = useState<View>(viewFromHash);

  // One page_view per visit (device-tagged) — the top of the funnel, so connect-clicks
  // and deploys can be read as a fraction of who actually arrived.
  useEffect(() => {
    logFunnel({ event: "page_view" });
  }, []);

  useEffect(() => {
    const onHash = () => {
      setView(viewFromHash());
      window.scrollTo({ top: 0, behavior: "auto" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (v: View) => {
    window.location.hash = v === "landing" ? "" : v; // hashchange drives setView
    setView(v); // and set directly so "#" edge cases (landing) still switch
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <>
      <Background />

      {/* App-level nav only on the inner views — the landing has its own floating
          navbar (Wallet/Activity live there now), so this would just clutter it. */}
      {view !== "landing" && (
        <Suspense fallback={null}>
          <AppNav view={view} onGo={go} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <AnimatePresence mode="wait">
          {view === "workspace" ? (
            <motion.div
              key="workspace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Workspace />
            </motion.div>
          ) : view === "wallet" ? (
            <motion.div
              key="wallet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Wallet />
            </motion.div>
          ) : view === "activity" ? (
            <motion.div
              key="activity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ActivityFeed />
            </motion.div>
          ) : view === "landing" ? (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.2, 0.7, 0.3, 1] }}
            >
              <Landing
                onLaunch={() => go("dashboard")}
                onWallet={() => go("wallet")}
                onActivity={() => go("activity")}
                onWorkspace={() => go("workspace")}
              />
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
      <FeedbackButton />
    </>
  );
}

