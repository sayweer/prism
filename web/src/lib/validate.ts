// Shared input validation for user-entered amounts and payment destinations. Pure and
// unit-testable, so the same checks front-run every wallet popup — a bad amount or address
// is caught with a clear message BEFORE we build a transaction, instead of surfacing an
// opaque SDK/Horizon error (or, for empty limit fields, a raw toStroops(NaN) throw).
import { StrKey } from "@stellar/stellar-sdk";

export type AmountResult = { ok: true; value: number } | { ok: false; msg: string };

/** Parse an XLM amount that must be a finite, strictly-positive number. */
export function parseXlmAmount(raw: string, label = "amount"): AmountResult {
  const s = raw.trim();
  if (!s) return { ok: false, msg: `Enter ${aOrAn(label)}.` };
  const value = Number(s);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, msg: `Enter a valid ${label} greater than zero.` };
  }
  return { ok: true, value };
}

/** Whether a string is a valid classic payment destination — a G… account or an
 *  M… muxed account. Contract (C…) addresses are not valid payment destinations. */
export function isValidPaymentDest(raw: string): boolean {
  const s = raw.trim();
  return StrKey.isValidEd25519PublicKey(s) || StrKey.isValidMed25519PublicKey(s);
}

function aOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}
