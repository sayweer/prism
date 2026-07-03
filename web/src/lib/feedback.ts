import { supabase, supabaseConfigured } from "./supabase";

export type ValuableFeature = "own_treasury" | "bounded" | "confidential_zk" | "x402" | "escrow_reputation";
export type WouldUse = "yes" | "maybe" | "no";

export interface FeedbackInput {
  rating: number;
  valuableFeature: ValuableFeature;
  improvementText: string;
  wouldUseProduction: WouldUse;
  handle?: string;
  walletAddress?: string;
}

const FEATURES: ValuableFeature[] = ["own_treasury", "bounded", "confidential_zk", "x402", "escrow_reputation"];
const USE: WouldUse[] = ["yes", "maybe", "no"];

export function validateFeedback(input: Partial<FeedbackInput>): string | null {
  const { rating, valuableFeature, improvementText, wouldUseProduction, handle, walletAddress } = input;
  const text = (improvementText ?? "").trim();

  // Collect every missing required field into ONE message — erroring one field at a
  // time makes impatient users close the modal before their feedback is saved.
  const missing: string[] = [];
  if (!rating || !Number.isInteger(rating) || rating < 1 || rating > 5) missing.push("a 1-5 rating");
  if (!valuableFeature || !FEATURES.includes(valuableFeature)) missing.push("the most valuable feature");
  if (text.length < 1) missing.push("what we should improve");
  if (!wouldUseProduction || !USE.includes(wouldUseProduction)) missing.push("whether you'd use it in production");
  if (missing.length > 0) return `Please add: ${missing.join(" · ")}.`;

  if (text.length > 2000) return "Please keep feedback under 2000 characters.";
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
  if (error) {
    // Surface the real cause for monitoring; the user still sees a friendly message.
    console.error("[prism] feedback insert failed:", error.message);
    return { ok: false, error: "Could not send feedback. Please try again." };
  }
  return { ok: true };
}
