// Testnet funding helpers — a fresh wallet has 0 XLM, so the very first workspace
// action (deploying a treasury) fails with an opaque error. Check the wallet's native
// balance via Horizon and offer friendbot funding when it's empty. Pure functions with
// an injectable fetch, so they're unit-testable.
import { HORIZON_URL } from "../config";

const FRIENDBOT_URL = "https://friendbot.stellar.org";

/** Minimum native balance (XLM) to comfortably deploy, fund, and use a treasury. */
export const MIN_XLM = 20;

/** Native XLM balance of a classic account, or null if the account doesn't exist yet. */
export async function getXlmBalance(
  address: string,
  fetchFn: typeof fetch = fetch,
): Promise<number | null> {
  const res = await fetchFn(`${HORIZON_URL}/accounts/${address}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Horizon error ${res.status} — could not read your wallet balance.`);
  const body = (await res.json()) as { balances?: { asset_type: string; balance: string }[] };
  const native = body.balances?.find((b) => b.asset_type === "native");
  return native ? Number(native.balance) : 0;
}

/** Ask friendbot to create + fund the account with test XLM. Friendbot only works for
 *  accounts that don't exist on testnet yet — an existing account gets a clear message. */
export async function fundWithFriendbot(
  address: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const res = await fetchFn(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`);
  if (res.ok) return;
  if (res.status === 400) {
    throw new Error(
      "This account is already funded — friendbot only tops up brand-new testnet accounts.",
    );
  }
  throw new Error(`Friendbot error ${res.status} — try again in a moment.`);
}

/** true when the balance is too low to deploy + fund a treasury. */
export function needsFunding(balance: number | null): boolean {
  return balance === null || balance < MIN_XLM;
}
