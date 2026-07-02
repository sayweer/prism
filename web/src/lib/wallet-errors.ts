// Wallet error classification — pure functions, so they're unit-testable. Map raw
// wallet/SDK errors into the three surfaced error types: wallet not installed,
// request rejected, and insufficient balance.

export function errText(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return typeof e === "string" ? e : "";
}

/** connect: wallet not installed (type 1) or request rejected (type 2). */
export function connectErr(e: unknown): string {
  const m = errText(e).toLowerCase();
  if (m.includes("not available") || m.includes("not installed") || m.includes("install")) {
    return "That wallet isn't installed — pick another option.";
  }
  if (
    m.includes("reject") || m.includes("denied") || m.includes("declin") ||
    m.includes("close") || m.includes("cancel")
  ) {
    return "Connection cancelled.";
  }
  return errText(e) || "Couldn't connect a wallet.";
}

/** send: insufficient balance (type 3) or signature rejected (type 2). */
export function sendErr(e: unknown): string {
  const codes = (e as {
    response?: { data?: { extras?: { result_codes?: { operations?: string[]; transaction?: string } } } };
  })?.response?.data?.extras?.result_codes;
  const opCodes = codes?.operations?.join(", ") || codes?.transaction || "";
  if (opCodes.includes("underfunded") || opCodes.toLowerCase().includes("insufficient")) {
    return "Insufficient balance for this payment.";
  }
  const m = errText(e).toLowerCase();
  if (m.includes("account not found") || m.includes("account does not exist")) {
    return "Your wallet has no XLM on testnet yet — use the funding box above to get free testnet XLM first.";
  }
  if (m.includes("underfunded") || m.includes("insufficient balance")) {
    return "Insufficient balance for this payment.";
  }
  if (m.includes("reject") || m.includes("denied") || m.includes("declin") || m.includes("cancel")) {
    return "Signature rejected in your wallet.";
  }
  return opCodes || errText(e) || "Transaction failed.";
}
