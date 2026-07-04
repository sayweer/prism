import { describe, it, expect } from "vitest";
import { connectErr, errText, sendErr } from "./wallet-errors";

describe("errText", () => {
  it("returns an Error's message", () => {
    expect(errText(new Error("boom"))).toBe("boom");
  });
  it("extracts a plain SDK error object's message instead of [object Object]", () => {
    // StellarWalletsKit's authModal rejects with a plain object, not an Error — the
    // reason funnel detail was logging "[object Object]" until it used this helper.
    expect(errText({ message: "Modal closed" })).toBe("Modal closed");
    expect(errText({ message: "Modal closed" })).not.toBe("[object Object]");
  });
  it("returns a string error as-is", () => {
    expect(errText("plain string error")).toBe("plain string error");
  });
  it("returns empty (never [object Object]) for a message-less object", () => {
    expect(errText({})).toBe("");
  });
});

describe("connectErr", () => {
  it("maps a not-installed wallet", () => {
    expect(connectErr(new Error("Freighter is not installed"))).toMatch(/isn't installed/);
  });
  it("maps a user rejection / closed modal", () => {
    expect(connectErr(new Error("User rejected the request"))).toBe("Connection cancelled.");
  });
});

describe("sendErr", () => {
  it("maps insufficient balance (op_underfunded)", () => {
    const e = { response: { data: { extras: { result_codes: { operations: ["op_underfunded"] } } } } };
    expect(sendErr(e)).toMatch(/Insufficient balance/);
  });
  it("maps a signature rejection", () => {
    expect(sendErr(new Error("User declined to sign"))).toMatch(/Signature rejected/);
  });
  it("maps a not-yet-funded testnet account (RPC getAccount)", () => {
    expect(sendErr(new Error("Account not found: GDPK…"))).toMatch(/no XLM on testnet/);
  });
  it("maps insufficient balance from a message (Soroban path)", () => {
    expect(sendErr(new Error("transaction simulation failed: insufficient balance"))).toMatch(
      /Insufficient balance/,
    );
  });
});
