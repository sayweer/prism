import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { TREASURY_ID, contractUrl } from "../config";
import "./landing.css";

const EASE = [0.22, 1, 0.36, 1] as const; // cinematic expo-out

/* Cinematic line reveal — each line sits in an overflow-hidden mask and rises
   from below (SplitText feel) on scroll-in. Lines can contain <em> accents. */
function RevealLines({
  lines,
  tag = "h2",
  className,
  delay = 0,
}: {
  lines: ReactNode[];
  tag?: "h1" | "h2";
  className?: string;
  delay?: number;
}) {
  // The visible heading is the observed element (it has box height even while its
  // inner spans are masked below), so whileInView fires. Child spans animate via
  // variants — never themselves observed, so the masked transform can't deadlock it.
  const MTag = tag === "h1" ? motion.h1 : motion.h2;
  return (
    <MTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ staggerChildren: 0.12, delayChildren: delay }}
    >
      {lines.map((ln, i) => (
        <span className="rmask" key={i}>
          <motion.span
            className="rword"
            variants={{ hidden: { y: "115%" }, show: { y: 0, transition: { duration: 0.95, ease: EASE } } }}
          >
            {ln}
          </motion.span>
        </span>
      ))}
    </MTag>
  );
}

/* Generic fade-up on scroll-in. */
function Reveal({
  children,
  className,
  delay = 0,
  y = 26,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ---- agent ledger: the agent's recent on-chain activity. Static + meaningful;
   rows reveal once on scroll-in (no churn). The blocked attempt is the punchline. ---- */
type Row = { tag: string; tagcls?: string; h: string; s: string; amt: string; amtcls?: string };
const LEDGER: Row[] = [
  { tag: "usdc · pay", h: "LLM inference · 4.2M tokens", s: "Inference API · task #101", amt: "3.00", amtcls: "ok" },
  { tag: "usdc · pay", h: "Real-time market data", s: "Data feed · task #102", amt: "2.00", amtcls: "ok" },
  { tag: "xlm · fund", tagcls: "tag--x", h: "Top-up · budget #1", s: "muxed deposit · no memo", amt: "+5.00" },
  { tag: "blocked", tagcls: "tag--no", h: "Drain → unknown wallet", s: "PayeeNotWhitelisted", amt: "0.00", amtcls: "no" },
];

function LiveLedger() {
  return (
    <Reveal delay={0.2}>
      <div className="proofcard">
        <div className="proofcard__bar">
          <span className="t"><i /> Agent · recent activity</span>
          <span className="net">testnet</span>
        </div>
        <div>
          {LEDGER.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: EASE, delay: 0.35 + i * 0.1 }}
            >
              <div className="prow">
                <span className={`tag ${r.tagcls ?? ""}`}>{r.tag}</span>
                <span className="d">
                  <div className="h">{r.h}</div>
                  <div className="s">{r.s}</div>
                </span>
                <span className={`amt ${r.amtcls ?? ""}`}>{r.amt}</span>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="proofcard__foot">
          <span>18 / 50 USDC today</span>
          <span>daily limit · on-chain</span>
        </div>
      </div>
    </Reveal>
  );
}

export default function Landing({
  onLaunch,
  onWallet,
  onActivity,
}: {
  onLaunch: () => void;
  onWallet: () => void;
  onActivity: () => void;
}) {
  return (
    <div className="lx">
      {/* nav */}
      <nav className="nav">
        <div className="brand"><span className="glyph" /> Prism</div>
        <div className="links">
          <span className="live"><i /> Stellar Testnet</span>
          <a href="#how">How it works</a>
          <button className="navlink" onClick={onWallet}>Wallet</button>
          <button className="navlink" onClick={onActivity}>Activity</button>
          <a href="https://github.com/Bekirerdem/prism" target="_blank" rel="noreferrer">GitHub ↗</a>
        </div>
        <button className="navcta" onClick={onLaunch}>Launch demo</button>
      </nav>

      <main className="wrap">
        {/* hero */}
        <header className="hero">
          <div className="hero__grid">
            <div>
              <motion.span
                className="eyebrow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                Bounded · confidential · agentic — on Stellar
              </motion.span>
              <RevealLines
                tag="h1"
                delay={0.15}
                lines={["The wallet your", <>AI agent <em>can't&nbsp;drain.</em></>]}
              />
              <Reveal delay={0.5}>
                <p className="lead">
                  Hand an autonomous agent real money to spend. The <b>contract</b> — not the
                  model's good behaviour — enforces every limit, proves compliance in{" "}
                  <b>zero-knowledge</b>, and settles in sub-cents.
                </p>
              </Reveal>
              <Reveal delay={0.62}>
                <div className="cta">
                  <button className="btn btn--p" onClick={onLaunch}>Launch live demo →</button>
                  <a className="btn" href={contractUrl(TREASURY_ID)} target="_blank" rel="noreferrer">Read the contract</a>
                </div>
              </Reveal>
              <Reveal delay={0.74}>
                <div className="scrolltag">
                  <span><b>6</b> on-chain guardrails</span>
                  <span><b>ZK</b> verified</span>
                  <span><b>x402</b> native</span>
                </div>
              </Reveal>
            </div>
            <LiveLedger />
          </div>
        </header>

        {/* 01 rails */}
        <section className="band" id="how">
          <Reveal><div className="kick"><span className="no">01</span><span className="eyebrow">Two rails · one contract</span></div></Reveal>
          <RevealLines tag="h2" className="title" lines={[<>Real dollars out. <em>Native value</em> in.</>]} />
          <Reveal delay={0.1}><p className="lead2">The same bounded treasury secures any Stellar asset — your agent pays the world in USDC and is funded in native XLM.</p></Reveal>
          <div className="rails">
            <Reveal className="rail" delay={0.05}>
              <div className="rk">USDC rail</div>
              <h3>Real dollars out</h3>
              <p>Every service the agent pays — inference, scraping, rendering — settles in USDC, gated by per-task and daily limits.</p>
              <div className="meta"><span><b>per-task</b> ≤ 10 USDC</span><span><b>daily</b> ≤ 50 USDC</span><span><b>payee</b> whitelist or reputation</span></div>
            </Reveal>
            <Reveal className="rail" delay={0.14}>
              <div className="rk">XLM rail</div>
              <h3>Native value in</h3>
              <p>Budgets are funded in native XLM via zero-cost muxed sub-addresses — attribution with no memos, no new accounts.</p>
              <div className="meta"><span><b>deposit</b> → muxed M-address</span><span><b>fees</b> sub-cent, in XLM</span><span><b>attribution</b> by budget id</span></div>
            </Reveal>
          </div>
        </section>

        {/* 02 guardrails */}
        <section className="band">
          <Reveal><div className="kick"><span className="no">02</span><span className="eyebrow">How the guardrails work</span></div></Reveal>
          <RevealLines tag="h2" className="title" lines={[<>Four checks the chain enforces — <em>not the model.</em></>]} />
          <div className="checks">
            {GUARDS.map((g, i) => (
              <Reveal className="check" key={g.t} delay={i * 0.05}>
                <span className="n">{g.n}</span>
                <h4>{g.t}</h4>
                <p>{g.p}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* 03 confidential ZK */}
        <section className="band">
          <Reveal><div className="kick"><span className="no">03</span><span className="eyebrow">Confidential mode · zero-knowledge</span></div></Reveal>
          <div className="feat">
            <div className="feat__txt">
              <Reveal><span className="eyebrow accent">New since hackathon</span></Reveal>
              <RevealLines tag="h2" delay={0.05} lines={[<>Prove every payment was in policy — <em>reveal nothing.</em></>]} />
              <Reveal delay={0.12}><p>A Groth16/BN254 circuit proves the payment sits inside its per-task and daily bounds and pays a whitelisted payee — without disclosing the amount or the recipient. The treasury verifies the proof on-chain and emits an attestation.</p></Reveal>
              <Reveal delay={0.2}>
                <div className="pts">
                  <div>Poseidon-Merkle whitelist + commitment binding (amount, payee, salt)</div>
                  <div>On-chain BN254 verifier — policy-bound, replay-guarded</div>
                  <div>Emits <span className="mono">attested</span> — auditable, not disclosed</div>
                </div>
              </Reveal>
            </div>
            <Reveal className="panel" delay={0.1}>
              <div className="plbl">compliance proof · public inputs</div>
              <div style={{ marginTop: 16 }}>
                <div className="zkrow"><span className="k">amount</span><span className="hidden">•••••• hidden</span></div>
                <div className="zkrow"><span className="k">payee</span><span className="hidden">•••••• hidden</span></div>
                <div className="zkrow"><span className="k">within per-task bound</span><span className="ok">✓ proven</span></div>
                <div className="zkrow"><span className="k">within daily bound</span><span className="ok">✓ proven</span></div>
                <div className="zkrow"><span className="k">payee ∈ whitelist</span><span className="ok">✓ proven</span></div>
              </div>
              <div className="attest">◆ attested · verified on-chain · replay-guarded</div>
            </Reveal>
          </div>
        </section>

        {/* 04 trust & outcomes */}
        <section className="band">
          <Reveal><div className="kick"><span className="no">04</span><span className="eyebrow">Trust &amp; outcomes</span></div></Reveal>
          <div className="feat rev">
            <div className="feat__txt">
              <Reveal><span className="eyebrow accent">New since hackathon</span></Reveal>
              <RevealLines tag="h2" delay={0.05} lines={[<>Pay strangers safely. Release on <em>outcomes.</em></>]} />
              <Reveal delay={0.12}><p>Beyond a static whitelist, a payee that earned reputation (ERC-8004) clears the gate. And funds can lock in escrow — released to the payee on success, refunded to the treasury if the deadline passes.</p></Reveal>
              <Reveal delay={0.2}>
                <div className="pts">
                  <div>Reputation-gated payees — whitelist OR earned trust ≥ threshold</div>
                  <div>Outcome-bound escrow — lock → release or refund</div>
                </div>
              </Reveal>
            </div>
            <Reveal className="panel" delay={0.1}>
              <div className="plbl">escrow · outcome flow</div>
              <div className="flow" style={{ marginTop: 16 }}>
                <div className="fstep"><span className="fn">1</span> Lock 4.00 USDC for task #204 <span className="fa">locked</span></div>
                <div className="fstep"><span className="fn">2</span> Payee delivers · approved <span className="fa">release →</span></div>
                <div className="fstep refund"><span className="fn">3</span> Deadline passed · unmet <span className="fa">refund ↩</span></div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 05 x402 */}
        <section className="band">
          <Reveal><div className="kick"><span className="no">05</span><span className="eyebrow">Agentic payments · x402</span></div></Reveal>
          <div className="feat">
            <div className="feat__txt">
              <Reveal><span className="eyebrow accent">New since hackathon</span></Reveal>
              <RevealLines tag="h2" delay={0.05} lines={[<>When a service says <em>402,</em> the bound still holds.</>]} />
              <Reveal delay={0.12}><p>An agent normally pays whatever a <span className="mono">402 Payment Required</span> server asks. Prism gates that request against the treasury policy first — an over-limit or wrong-payee charge never reaches settlement.</p></Reveal>
              <Reveal delay={0.2}>
                <div className="pts">
                  <div>Gate mirrors the on-chain policy before any signature</div>
                  <div>Only in-policy requests settle through the bounded treasury</div>
                </div>
              </Reveal>
            </div>
            <Reveal className="panel" delay={0.1}>
              <div className="plbl">x402 · gated settlement</div>
              <div className="x402" style={{ marginTop: 14 }}>
                <div className="l"><span className="c">server</span><span className="m402">402 Payment Required · 6.00 USDC</span></div>
                <div className="l"><span className="c">gate</span><span className="gate">within per-task ≤ 10 ✓ · payee whitelisted ✓</span></div>
                <div className="l"><span className="c">in-policy</span><span className="gate">→ settled 6.00 USDC · tx 9dc3…</span></div>
                <div className="l"><span className="c">14.00 ask</span><span className="m402">→ refused · exceeds limit · never signed</span></div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* 06 rogue proof */}
        <section className="band rogue">
          <div className="proofwide">
            <div>
              <Reveal><div className="kick"><span className="no">06</span><span className="eyebrow">The proof · prompt-injection</span></div></Reveal>
              <RevealLines tag="h2" className="title" lines={["The model got jailbroken.", <><em>The contract didn't care.</em></>]} />
              <Reveal delay={0.12}><p className="lead2">A poisoned prompt tells the agent to drain everything to an attacker wallet. It signs the transaction. Stellar reverts it on-chain before a single cent leaves the treasury.</p></Reveal>
              <Reveal delay={0.2}><span className="reason">PayeeNotWhitelisted · funds never moved</span></Reveal>
            </div>
            <Reveal delay={0.1}>
              <div className="big">0<small>USDC moved</small></div>
            </Reveal>
          </div>
        </section>

        {/* final */}
        <section className="final">
          <Reveal><span className="eyebrow">Live on Stellar testnet</span></Reveal>
          <RevealLines tag="h2" delay={0.05} lines={[<>It's already <em>live.</em></>]} />
          <Reveal delay={0.15}><p>Deployed on testnet — paying real USDC, proving compliance in zero-knowledge, rejecting real exploits.</p></Reveal>
          <Reveal delay={0.22}>
            <div className="cta">
              <button className="btn btn--p" onClick={onLaunch}>Launch live demo →</button>
              <a className="btn" href={contractUrl(TREASURY_ID)} target="_blank" rel="noreferrer">Treasury contract</a>
            </div>
          </Reveal>
        </section>

        {/* footer */}
        <footer className="foot">
          <div className="b"><span className="glyph" /> Prism</div>
          <div className="op"><i /> System operational · Build On Stellar · IBW 2026</div>
          <div className="op" style={{ color: "var(--lx-dim)" }}>Bekir Erdem · Seyit Ali Değirmen</div>
        </footer>
      </main>
    </div>
  );
}

const GUARDS = [
  { n: "01", t: "Payee whitelist", p: "Only pre-approved addresses — or payees that earned on-chain reputation — can ever receive funds." },
  { n: "02", t: "Per-task limit", p: "Each task can spend up to a hard cap — no single job overspends." },
  { n: "03", t: "Daily limit", p: "A daily UTC ceiling — runaway loops hit a wall, every calendar day." },
  { n: "04", t: "Auto-accounting", p: "Spend is tagged to its task on-chain — reconcile with zero memos." },
];
