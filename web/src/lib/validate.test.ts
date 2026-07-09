import { describe, it, expect } from "vitest";
import { parseXlmAmount, isValidPaymentDest } from "./validate";

describe("parseXlmAmount", () => {
  it("accepts a positive number", () => {
    expect(parseXlmAmount("12.5")).toEqual({ ok: true, value: 12.5 });
  });
  it("trims surrounding whitespace", () => {
    expect(parseXlmAmount("  3 ")).toEqual({ ok: true, value: 3 });
  });
  it("rejects empty input", () => {
    expect(parseXlmAmount("")).toEqual({ ok: false, msg: "Enter an amount." });
  });
  it("rejects zero and negatives", () => {
    expect(parseXlmAmount("0").ok).toBe(false);
    expect(parseXlmAmount("-1").ok).toBe(false);
  });
  it("rejects non-numeric input", () => {
    expect(parseXlmAmount("abc").ok).toBe(false);
  });
  it("uses the given label in its message", () => {
    expect(parseXlmAmount("", "daily limit")).toEqual({ ok: false, msg: "Enter a daily limit." });
  });
});

describe("isValidPaymentDest", () => {
  // A well-known valid testnet account (StrKey Ed25519 public key).
  const G = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";
  it("accepts a valid G… account", () => {
    expect(isValidPaymentDest(G)).toBe(true);
  });
  it("rejects a contract C… address", () => {
    expect(isValidPaymentDest("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC")).toBe(false);
  });
  it("rejects empty and malformed input", () => {
    expect(isValidPaymentDest("")).toBe(false);
    expect(isValidPaymentDest("not-an-address")).toBe(false);
  });
});
