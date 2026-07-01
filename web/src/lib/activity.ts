// Best-effort telemetry: record each user's on-chain interaction (treasury deploy, fund,
// whitelist, pay, or a policy-rejected pay) so real usage is provable — this is the evidence
// backbone for Level 4's "10+ user wallet interactions". Logging never blocks the UX.
import { supabase, supabaseConfigured } from "./supabase";

export type ActivityAction = "deploy" | "fund" | "whitelist" | "pay" | "reject";

export interface ActivityInput {
  walletAddress: string;
  treasuryId?: string;
  action: ActivityAction;
  txHash?: string;
  amountXlm?: number;
}

/** Shape + clamp an activity row to the table's column limits (pure, testable). */
export function buildActivityRow(input: ActivityInput) {
  return {
    wallet_address: input.walletAddress.slice(0, 64),
    treasury_id: input.treasuryId ? input.treasuryId.slice(0, 64) : null,
    action: input.action,
    tx_hash: input.txHash ? input.txHash.slice(0, 80) : null,
    amount_xlm: input.amountXlm ?? null,
  };
}

export async function logActivity(input: ActivityInput): Promise<void> {
  if (!supabaseConfigured || !supabase || !input.walletAddress) return;
  try {
    await supabase.from("activity").insert(buildActivityRow(input));
  } catch (e) {
    // best-effort — a logging failure must never break the user's action
    console.error("[prism] activity log failed:", e instanceof Error ? e.message : e);
  }
}
