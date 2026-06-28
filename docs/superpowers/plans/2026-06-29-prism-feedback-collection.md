# Prism Feedback Collection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app feedback form to Prism so real users submit structured product feedback (stored in Supabase) — satisfying risein Level 4 "feedback collection" and tying feedback to wallet interactions.

**Architecture:** A Supabase `feedback` table (anon insert-only via RLS) receives rows written directly from the browser with `@supabase/supabase-js`. A fixed `FeedbackButton` opens a `FeedbackModal` with a rich form; a thin `lib/feedback.ts` owns validation + the Supabase insert. The connected wallet address (if any) is bridged from `Wallet.tsx` via `sessionStorage` and auto-filled.

**Tech Stack:** Vite + React + TypeScript, `@supabase/supabase-js`, Vitest, inline-style components (existing Prism pattern).

## Global Constraints

- Visual language (copy verbatim from existing components): Stellar-yellow accent `#FDDA24`, dark glass surfaces `rgba(18,18,28,0.72)` + `1px solid rgba(255,255,255,0.08)` + `backdropFilter: blur(12px)`, text `#EDEDF4`, muted `#A0A0B8`, fonts `'Inter', system-ui` (body) / `'Fraunces', Georgia, serif` (headings). Use inline `React.CSSProperties` objects like `Wallet.tsx` — no CSS framework.
- Styling approach: inline style objects at the bottom of the component file (mirror `Wallet.tsx`).
- Components are `export default function`; state via `useState`/`useCallback`.
- Supabase access uses only the **anon/publishable** key (public, RLS is the boundary). Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Vite `VITE_` prefix, read via `import.meta.env`).
- Validation rules (enforced client-side AND in the DB): `rating` integer 1–5; `valuable_feature` ∈ {`bounded`,`confidential_zk`,`x402`,`escrow_reputation`}; `would_use_production` ∈ {`yes`,`maybe`,`no`}; `improvement_text` non-empty, trimmed, length ≤ 2000; `handle` ≤ 80 chars optional; `wallet_address` ≤ 64 chars optional.
- Tests: Vitest, colocated `*.test.ts` in `web/src/lib/`, pattern `import { describe, it, expect } from "vitest"`.
- All commands run from `C:\Users\l3eki\Desktop\prism\web` unless noted. Web tests/build run on Windows fine (no WSL needed for vitest/build).

---

### Task 1: Supabase backend — `feedback` table + RLS

**Files:** none in repo (managed via Supabase MCP). Record the project ref + URL in the PR description / DEPLOYMENT notes.

**Interfaces:**
- Produces: a Supabase project URL + anon key (consumed by Task 2), and table `feedback` with columns `id, rating, valuable_feature, improvement_text, would_use_production, handle, wallet_address, created_at`.

- [ ] **Step 1: Pick the Supabase project**

Use the Supabase MCP `list_projects`. Choose an existing project to host Prism feedback (or create one named `prism`). Note its project ref, URL, and anon/publishable key (via `get_project_url` + `get_publishable_keys`).

- [ ] **Step 2: Apply the migration (table + RLS)**

Use Supabase MCP `apply_migration` (name: `create_feedback`) with this SQL:

```sql
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  rating smallint not null check (rating between 1 and 5),
  valuable_feature text not null check (valuable_feature in ('bounded','confidential_zk','x402','escrow_reputation')),
  improvement_text text not null check (char_length(improvement_text) between 1 and 2000),
  would_use_production text not null check (would_use_production in ('yes','maybe','no')),
  handle text check (handle is null or char_length(handle) <= 80),
  wallet_address text check (wallet_address is null or char_length(wallet_address) <= 64),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "anon can insert feedback"
  on public.feedback for insert
  to anon
  with check (true);
```

- [ ] **Step 3: Verify RLS shape**

Use Supabase MCP `execute_sql`: `select * from public.feedback;` as the anon role should return no rows / be denied for select (no select policy). Confirm the table exists via `list_tables`. Run `get_advisors` (security) and confirm no critical RLS warning beyond the intended insert-only design.

- [ ] **Step 4: Record config**

No commit (no repo change). Capture URL + anon key for Task 2's `.env`.

---

### Task 2: Dependency + Supabase client

**Files:**
- Modify: `web/package.json` (add dep)
- Create: `web/.env` (gitignored), `web/.env.example`
- Create: `web/src/lib/supabase.ts`

**Interfaces:**
- Produces: `supabase` (a `SupabaseClient`) exported from `web/src/lib/supabase.ts`, consumed by Task 3.

- [ ] **Step 1: Install the client**

Run: `npm install @supabase/supabase-js`
Expected: `package.json` + `package-lock.json` updated, `added N packages`.

- [ ] **Step 2: Add env files**

Create `web/.env` (gitignored — confirm `.env` is in `web/.gitignore`; add it if missing):

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-publishable-key>
```

Create `web/.env.example` (committed):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Write the client module**

Create `web/src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Feedback is optional infrastructure — if env is missing in a build, the form
// degrades gracefully (see lib/feedback.ts) instead of crashing the app.
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url as string, anonKey as string, { auth: { persistSession: false } })
  : null;
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS (tsc -b && vite build), no type errors.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/.env.example web/src/lib/supabase.ts web/.gitignore
git commit -m "feat(web): add supabase client + env scaffold for feedback"
```

---

### Task 3: `feedback.ts` — types, validation, submit (TDD)

**Files:**
- Create: `web/src/lib/feedback.ts`
- Test: `web/src/lib/feedback.test.ts`

**Interfaces:**
- Consumes: `supabase`, `supabaseConfigured` from `./supabase`.
- Produces:
  - type `FeedbackInput = { rating: number; valuableFeature: ValuableFeature; improvementText: string; wouldUseProduction: WouldUse; handle?: string; walletAddress?: string }`
  - `ValuableFeature = "bounded" | "confidential_zk" | "x402" | "escrow_reputation"`
  - `WouldUse = "yes" | "maybe" | "no"`
  - `validateFeedback(input: Partial<FeedbackInput>): string | null` — returns an error message, or `null` if valid.
  - `submitFeedback(input: FeedbackInput): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/feedback.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateFeedback } from "./feedback";

const valid = {
  rating: 5,
  valuableFeature: "confidential_zk" as const,
  improvementText: "Add a mainnet mode.",
  wouldUseProduction: "yes" as const,
};

describe("validateFeedback", () => {
  it("returns null for a valid input", () => {
    expect(validateFeedback(valid)).toBeNull();
  });
  it("rejects missing rating", () => {
    expect(validateFeedback({ ...valid, rating: 0 })).toMatch(/rating/i);
  });
  it("rejects an out-of-range rating", () => {
    expect(validateFeedback({ ...valid, rating: 6 })).toMatch(/rating/i);
  });
  it("rejects an unknown valuable feature", () => {
    expect(validateFeedback({ ...valid, valuableFeature: "other" as any })).toMatch(/feature/i);
  });
  it("rejects empty improvement text", () => {
    expect(validateFeedback({ ...valid, improvementText: "   " })).toMatch(/improve/i);
  });
  it("rejects improvement text over 2000 chars", () => {
    expect(validateFeedback({ ...valid, improvementText: "x".repeat(2001) })).toMatch(/2000/);
  });
  it("rejects an unknown production answer", () => {
    expect(validateFeedback({ ...valid, wouldUseProduction: "sometimes" as any })).toMatch(/production/i);
  });
  it("rejects an over-long handle", () => {
    expect(validateFeedback({ ...valid, handle: "x".repeat(81) })).toMatch(/handle/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- feedback`
Expected: FAIL with "validateFeedback is not a function" / module not found.

- [ ] **Step 3: Write the implementation**

Create `web/src/lib/feedback.ts`:

```ts
import { supabase, supabaseConfigured } from "./supabase";

export type ValuableFeature = "bounded" | "confidential_zk" | "x402" | "escrow_reputation";
export type WouldUse = "yes" | "maybe" | "no";

export interface FeedbackInput {
  rating: number;
  valuableFeature: ValuableFeature;
  improvementText: string;
  wouldUseProduction: WouldUse;
  handle?: string;
  walletAddress?: string;
}

const FEATURES: ValuableFeature[] = ["bounded", "confidential_zk", "x402", "escrow_reputation"];
const USE: WouldUse[] = ["yes", "maybe", "no"];

export function validateFeedback(input: Partial<FeedbackInput>): string | null {
  const { rating, valuableFeature, improvementText, wouldUseProduction, handle, walletAddress } = input;
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return "Please give a rating from 1 to 5.";
  }
  if (!valuableFeature || !FEATURES.includes(valuableFeature)) {
    return "Please pick the most valuable feature.";
  }
  const text = (improvementText ?? "").trim();
  if (text.length < 1) return "Please tell us what to improve.";
  if (text.length > 2000) return "Please keep feedback under 2000 characters.";
  if (!wouldUseProduction || !USE.includes(wouldUseProduction)) {
    return "Please answer whether you'd use this in production.";
  }
  if (handle && handle.length > 80) return "Handle is too long (max 80).";
  if (walletAddress && walletAddress.length > 64) return "Wallet address looks too long.";
  return null;
}

export async function submitFeedback(
  input: FeedbackInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const err = validateFeedback(input);
  if (err) return { ok: false, error: err };
  if (!supabaseConfigured || !supabase) {
    return { ok: false, error: "Feedback is temporarily unavailable. Please try again later." };
  }
  const { error } = await supabase.from("feedback").insert({
    rating: input.rating,
    valuable_feature: input.valuableFeature,
    improvement_text: input.improvementText.trim(),
    would_use_production: input.wouldUseProduction,
    handle: input.handle?.trim() || null,
    wallet_address: input.walletAddress?.trim() || null,
  });
  if (error) return { ok: false, error: "Could not send feedback. Please try again." };
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- feedback`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/feedback.ts web/src/lib/feedback.test.ts
git commit -m "feat(web): feedback validation + submit (tested)"
```

---

### Task 4: `FeedbackModal` component

**Files:**
- Create: `web/src/components/FeedbackModal.tsx`

**Interfaces:**
- Consumes: `submitFeedback`, `validateFeedback`, types from `../lib/feedback`.
- Produces: `export default function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void })`.

- [ ] **Step 1: Write the component**

Create `web/src/components/FeedbackModal.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/FeedbackModal.tsx
git commit -m "feat(web): feedback modal (rich form)"
```

---

### Task 5: `FeedbackButton` + mount in `App.tsx`

**Files:**
- Create: `web/src/components/FeedbackButton.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `FeedbackModal` from `./FeedbackModal`.
- Produces: `export default function FeedbackButton()` (self-contained: owns the open/close state).

- [ ] **Step 1: Write the button**

Create `web/src/components/FeedbackButton.tsx`:

```tsx
import { useState } from "react";
import FeedbackModal from "./FeedbackModal";

export default function FeedbackButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button style={fab} onClick={() => setOpen(true)} type="button">
        Share feedback
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const fab: React.CSSProperties = {
  position: "fixed", right: 18, bottom: 18, zIndex: 1500,
  padding: "11px 17px", borderRadius: 999, cursor: "pointer",
  background: "rgba(18,18,28,0.82)", border: "1px solid rgba(253,218,36,0.45)",
  color: "#FDDA24", fontWeight: 600, fontSize: 13.5, backdropFilter: "blur(8px)",
  boxShadow: "0 8px 24px -10px rgba(0,0,0,0.6)",
};
```

- [ ] **Step 2: Mount it in App.tsx**

Modify `web/src/App.tsx`. Add the import after the existing component imports (line ~4):

```tsx
import FeedbackButton from "./components/FeedbackButton";
```

Add `<FeedbackButton />` just before the closing `</>` of the returned fragment (after the `</Suspense>`, line ~107):

```tsx
      </Suspense>
      <FeedbackButton />
    </>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/FeedbackButton.tsx web/src/App.tsx
git commit -m "feat(web): global feedback button mounted app-wide"
```

---

### Task 6: Wallet → sessionStorage bridge (auto-fill)

**Files:**
- Modify: `web/src/components/Wallet.tsx:83` (after `setAddress(addr)`) and `web/src/components/Wallet.tsx:97` (in `disconnect`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `sessionStorage["prism_wallet_address"]` set on connect, removed on disconnect (consumed by `FeedbackModal`'s `useEffect`).

- [ ] **Step 1: Write on connect**

In `web/src/components/Wallet.tsx`, inside `connect`, immediately after `setAddress(addr);` (line 83), add:

```ts
      sessionStorage.setItem("prism_wallet_address", addr);
```

- [ ] **Step 2: Clear on disconnect**

Inside `disconnect`, after `setAddress(null);` (line 97), add:

```ts
    sessionStorage.removeItem("prism_wallet_address");
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Wallet.tsx
git commit -m "feat(web): bridge connected wallet to feedback via sessionStorage"
```

---

### Task 7: Deploy + env + manual verification

**Files:** none (config + verification).

- [ ] **Step 1: Add env to Vercel**

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the `prism-stellar` Vercel project (Production), e.g.:

```bash
vercel env add VITE_SUPABASE_URL production --scope team_ABgqwGiQe6n77r7bbnlBF5O3 --cwd C:\Users\l3eki\Desktop\prism\web
vercel env add VITE_SUPABASE_ANON_KEY production --scope team_ABgqwGiQe6n77r7bbnlBF5O3 --cwd C:\Users\l3eki\Desktop\prism\web
```

(or set them in the Vercel dashboard for the `prism-stellar` project).

- [ ] **Step 2: Deploy**

Run: `vercel --prod --scope team_ABgqwGiQe6n77r7bbnlBF5O3 --cwd C:\Users\l3eki\Desktop\prism\web`
Expected: `Aliased: https://prism-stellar.vercel.app`.

- [ ] **Step 3: Manual verification (live)**

1. Open `https://prism-stellar.vercel.app` → click "Share feedback" (bottom-right) → modal opens.
2. Submit a complete form → success state shows.
3. With Supabase MCP `execute_sql`: `select count(*), max(created_at) from public.feedback;` → the new row is present.
4. Connect a wallet in the Wallet view, reopen feedback → wallet field auto-fills.
5. Confirm anon cannot read: a client `select` returns nothing (RLS).

- [ ] **Step 4: Push**

```bash
git push
```

---

## Notes for the implementer

- `git push`/`vercel` network calls must run in **PowerShell**, not the Bash tool (MSYS DNS fails). `vercel ... 2>&1` shows a NativeCommandError wrapper but the real "Success!" line is valid.
- Do **not** commit `web/.env` (real keys). Only `web/.env.example` is committed.
- Do not touch `Cargo.lock` (build artifact) when staging.
- If `npm test` runs all suites, scope with `npm test -- feedback`.
