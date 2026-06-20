import { motion } from "framer-motion";
import PrismMark from "./PrismMark";
import {
  TREASURY_ID,
  USDC_SAC,
  ROGUE,
  ATTACKER,
  contractUrl,
  fmtUSDC,
  shortAddr,
} from "../config";

const EASE = [0.2, 0.7, 0.3, 1] as const;
const SPRING = { type: "spring", stiffness: 320, damping: 26 } as const;
const T = { nav: 0.12, prism: 0.3, eyebrow: 0.36, l1: 0.44, l2: 0.54, l3: 0.64, sub: 0.8, cta: 0.92 };

const up = (delay: number) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: EASE, delay },
});
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.65, ease: EASE, delay },
});

export default function Landing({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="landing">
      {/* ───────── nav ───────── */}
      <motion.nav className="nav" {...up(T.nav)}>
        <div className="nav__brand">
          <PrismMark variant="mark" size={30} />
          <span className="nav__name">Prism</span>
        </div>
        <div className="nav__r">
          <span className="pill"><span className="dot dot--live" /> Stellar Testnet</span>
          <a className="pill mono" href="https://github.com/Bekirerdem" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
      </motion.nav>

      <main className="wrap">
        {/* ───────── hero ───────── */}
        <section className="hero">
          <div>
            <motion.span
              className="eyebrow hero__eye pill"
              style={{ borderColor: "rgba(124,58,237,0.3)", color: "#C3A6FF", background: "rgba(124,58,237,0.08)" }}
              {...up(T.eyebrow)}
            >
              Bounded agent payments · on Stellar
            </motion.span>
            <h1 className="hero__title">
              <motion.span {...up(T.l1)}>The wallet your</motion.span>
              <motion.span {...up(T.l2)}>AI agent</motion.span>
              <motion.span className="spectral-focal" {...up(T.l3)}>can&apos;t&nbsp;drain.</motion.span>
            </h1>
            <motion.p className="hero__sub" {...up(T.sub)}>
              Hand an autonomous agent real money to spend. The <b>contract</b> — not the model&apos;s
              good behaviour — enforces the limits, every payment is auto-accounted, and Stellar
              settles in sub-cents.
            </motion.p>
            <motion.div
              className="hero__cta"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING, delay: T.cta }}
            >
              <button className="btn btn--primary" onClick={onLaunch}>Launch live demo →</button>
              <a className="btn" href={contractUrl(TREASURY_ID)} target="_blank" rel="noreferrer">View contract on testnet</a>
            </motion.div>
          </div>

        </section>

        {/* ───────── stat console ───────── */}
        <motion.section className="glass glass--violet console" {...reveal()}>
          <div className="cell">
            <div className="fig spectral">USDC</div>
            <div className="lbl">Real on-chain settlement</div>
          </div>
          <div className="cell">
            <div className="fig">&lt; $0.01</div>
            <div className="lbl">Per agent payment</div>
          </div>
          <div className="cell cell--glow">
            <div className="fig spectral">0</div>
            <div className="lbl">Funds an exploit can move</div>
          </div>
        </motion.section>

        {/* ───────── trust pills ───────── */}
        <motion.div className="trust" {...reveal(0.05)}>
          <span className="pill"><span className="dot dot--live" /> LIVE on Stellar testnet</span>
          <span className="pill">Non-custodial</span>
          <span className="pill">Sub-cent fees</span>
          <span className="pill" style={{ borderColor: "rgba(124,58,237,0.34)", color: "#C3A6FF" }}>
            0 funds an exploit can move
          </span>
        </motion.div>

        {/* ───────── how the guardrails work ───────── */}
        <section className="section">
          <motion.div className="sec-head" {...reveal()}>
            <div className="eyebrow sec-eyebrow">How the guardrails work</div>
            <h2 className="sec-title">Four checks the <span className="spectral">chain enforces</span> — not the model.</h2>
            <p className="sec-lead">The agent proposes a payment. The treasury contract validates it against your policy and rejects anything outside the lines, on-chain, every time.</p>
          </motion.div>

          <motion.div className="hex-stage" {...reveal(0.08)}>
            <div className="hex-grid">
              {/* connecting wires */}
              <svg className="hexnet" viewBox="0 0 900 360" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="wire" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#7C3AED" stopOpacity="0.8" />
                    <stop offset="1" stopColor="#22D3EE" stopOpacity="0.5" />
                  </linearGradient>
                </defs>
                <g stroke="url(#wire)" strokeWidth="1.4" fill="none" opacity="0.8">
                  <path d="M450 150 C 200 180, 130 200, 110 250" />
                  <path d="M450 150 C 360 200, 330 210, 320 250" />
                  <path d="M450 150 C 540 200, 570 210, 580 250" />
                  <path d="M450 150 C 700 180, 770 200, 790 250" />
                </g>
                <g fill="#22D3EE">
                  <circle cx="110" cy="250" r="2.5" />
                  <circle cx="320" cy="250" r="2.5" />
                  <circle cx="580" cy="250" r="2.5" />
                  <circle cx="790" cy="250" r="2.5" />
                </g>
              </svg>

              {/* central hex */}
              <div className="hex hex--center">
                <div className="hex__shape">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C3A6FF" strokeWidth="1.6">
                    <path d="M12 2 L20 6.5 V15.5 L12 20 L4 15.5 V6.5 Z" />
                    <path d="M9 12 l2 2 l4 -5" stroke="#C9FF23" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="hcap">Treasury<br />Contract</div>
                  <div className="hsub">Soroban · on-chain</div>
                </div>
              </div>

              {/* satellites */}
              <div className="satrow">
                <div className="sat">
                  <div className="sat__ico">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="1.7"><circle cx="9" cy="8" r="3.2" /><path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5" strokeLinecap="round" /><path d="M16 11 l2 2 l4 -4" stroke="#C9FF23" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <h4>Payee whitelist</h4>
                  <p>Only pre-approved addresses can ever receive funds.</p>
                </div>
                <div className="sat">
                  <div className="sat__ico">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9FB6FF" strokeWidth="1.7"><rect x="3" y="11" width="18" height="9" rx="2" /><path d="M7 11V8a5 5 0 0 1 10 0v3" /><circle cx="12" cy="15.5" r="1.4" fill="#9FB6FF" stroke="none" /></svg>
                  </div>
                  <h4>Per-task limit</h4>
                  <p>Each task can spend up to a hard cap — no single job overspends.</p>
                </div>
                <div className="sat">
                  <div className="sat__ico">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C3A6FF" strokeWidth="1.7"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <h4>Daily limit</h4>
                  <p>A daily UTC ceiling, reset every calendar day at 00:00 — runaway loops hit a wall.</p>
                </div>
                <div className="sat">
                  <div className="sat__ico">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9FF23" strokeWidth="1.7"><path d="M4 6h16M4 12h11M4 18h14" strokeLinecap="round" /><circle cx="19" cy="12" r="2" /></svg>
                  </div>
                  <h4>Auto-accounting</h4>
                  <p>Spend is tagged to its task on-chain — reconcile with zero memos.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ───────── why stellar ───────── */}
        <section className="section">
          <motion.div className="sec-head" {...reveal()}>
            <div className="eyebrow sec-eyebrow">Why Stellar</div>
            <h2 className="sec-title">Primitives nothing else has <span className="spectral">this cheap.</span></h2>
            <p className="sec-lead">Agent payment swarms need attribution, micro-fees, and real dollars. Stellar ships all three as native primitives.</p>
          </motion.div>

          <div className="feat-grid">
            {WHY.map((w, i) => (
              <motion.div className="glass feat" key={w.t} {...reveal(0.06 + i * 0.06)}>
                <div className="feat__ico">{w.ico}</div>
                <div className="feat__k">{w.k}</div>
                <h3>{w.t}</h3>
                <p>{w.p}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ───────── rogue rejection band ───────── */}
        <motion.section className="rogue" {...reveal()}>
          <div className="rogue__grid">
            <div>
              <div className="eyebrow rogue__eye">The proof · prompt-injection</div>
              <h2 className="rogue__title">The model got jailbroken.<br /><span className="x">The contract didn&apos;t care.</span></h2>
              <p className="rogue__sub">A poisoned prompt tells the agent to drain everything to an attacker wallet. It signs the transaction. Stellar reverts it on-chain before a single cent leaves the treasury.</p>
              <div style={{ marginTop: 20 }}><span className="badge badge--rej">✕ PayeeNotWhitelisted · funds never moved</span></div>
            </div>

            <div className="rogue__panel">
              <div className="rogue__row"><span className="k">attempt</span><span className="v">{ROGUE.name}</span></div>
              <div className="rogue__row"><span className="k">to</span><span className="v mono">{shortAddr(ATTACKER)}</span></div>
              <div className="rogue__row"><span className="k">amount</span><span className="v mono">{fmtUSDC(ROGUE.amount)} USDC</span></div>
              <div className="rogue__row"><span className="k">result</span><span className="v" style={{ color: "#FF6E8A" }}>reverted</span></div>
              <div className="rogue__zero">
                <div className="big mono">0 USDC</div>
                <div className="cap">moved</div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ───────── final CTA ───────── */}
        <motion.section className="glass glass--violet cta-band" {...reveal()}>
          <PrismMark variant="mark" size={44} />
          <h2>It&apos;s already live.</h2>
          <p>Deployed on Stellar testnet, paying real USDC, rejecting real exploits. See it move money it&apos;s allowed to — and refuse the money it isn&apos;t.</p>
          <div className="row">
            <button className="btn btn--primary" onClick={onLaunch}>Launch live demo →</button>
            <a className="btn" href={contractUrl(TREASURY_ID)} target="_blank" rel="noreferrer">Treasury contract</a>
            <a className="btn" href={contractUrl(USDC_SAC)} target="_blank" rel="noreferrer">USDC</a>
          </div>
        </motion.section>

        {/* ───────── footer ───────── */}
        <footer className="footer">
          <div className="brand">
            <PrismMark variant="mark" size={24} />
            Prism
            <span className="dim" style={{ fontFamily: "var(--sans)", fontWeight: 400, fontSize: 13, marginLeft: 6 }}>
              Build On Stellar · IBW 2026
            </span>
          </div>
          <div className="dim mono" style={{ fontSize: 12.5 }}>
            Bekir Erdem · Seyit Ali Değirmen ·{" "}
            <a className="glow-link" href="https://github.com/Bekirerdem" target="_blank" rel="noreferrer">GitHub ↗</a>
          </div>
        </footer>
      </main>
    </div>
  );
}

const WHY = [
  {
    k: "Attribution",
    t: "Muxed accounts",
    p: "One account, infinite zero-cost sub-addresses — the attribution layer for payment swarms. No equivalent is this cheap elsewhere.",
    ico: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C3A6FF" strokeWidth="1.7">
        <circle cx="12" cy="6" r="2.4" />
        <circle cx="6" cy="18" r="2.4" />
        <circle cx="18" cy="18" r="2.4" />
        <path d="M12 8.4 V13 M12 13 L6.6 16 M12 13 L17.4 16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    k: "Economics",
    t: "Sub-cent fees",
    p: "Deterministic, fraction-of-a-cent fees make agent micro-payments actually economical. Gas would eat them alive.",
    ico: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="1.7">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M14.5 9.2c-.6-.9-1.6-1.3-2.7-1.3-1.5 0-2.6.8-2.6 2 0 2.7 5.4 1.4 5.4 4.1 0 1.3-1.2 2.1-2.8 2.1-1.2 0-2.3-.5-2.9-1.4" strokeLinecap="round" />
        <path d="M12 6v1.6M12 16.4V18" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    k: "Real money",
    t: "Native USDC",
    p: "Real dollars, path-payment FX, and fiat off-ramps in 170+ countries connect the agent to the real world.",
    ico: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9FF23" strokeWidth="1.7">
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <circle cx="12" cy="12" r="2.6" />
        <path d="M6 9.5h.01M18 14.5h.01" strokeLinecap="round" />
      </svg>
    ),
  },
];
