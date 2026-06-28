import { createClient } from "@supabase/supabase-js";

// .trim() guards against trailing newlines/whitespace in env values (e.g. from
// `vercel env add` over a pipe) — a stray "\n" in the URL/key breaks the client.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

// Feedback is optional infrastructure — if env is missing in a build, the form
// degrades gracefully (see lib/feedback.ts) instead of crashing the app.
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase = supabaseConfigured
  ? createClient(url as string, anonKey as string, { auth: { persistSession: false } })
  : null;
