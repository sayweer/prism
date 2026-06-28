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
