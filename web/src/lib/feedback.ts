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
