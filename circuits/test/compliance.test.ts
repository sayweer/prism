import { Circomkit } from "circomkit";

const circomkit = new Circomkit();
const N = 8;
const LEVELS = 8;
const NBITS = 64;

describe("Compliance — range & daily-sum", function () {
  this.timeout(180000);
  let T: any;

  before(async () => {
    T = await circomkit.WitnessTester("compliance", {
      file: "compliance",
      template: "Compliance",
      params: [N, LEVELS, NBITS],
      pubs: ["dailyLimit", "perTaskLimit", "whitelistRoot", "periodId", "commitments"],
    });
  });

  // Task 2 only constrains amounts; not-yet-used signals are zero-filled.
  const base = () => ({
    dailyLimit: 1000,
    perTaskLimit: 300,
    whitelistRoot: 0,
    periodId: 1,
    commitments: Array(N).fill(0),
    amount: [100, 200, 0, 0, 0, 0, 0, 0],
    payee: Array(N).fill(0),
    salt: Array(N).fill(0),
    pathElements: Array.from({ length: N }, () => Array(LEVELS).fill(0)),
    pathIndices: Array.from({ length: N }, () => Array(LEVELS).fill(0)),
  });

  it("passes a compliant batch", async () => {
    await T.expectPass(base());
  });

  it("fails when one amount exceeds the per-task limit", async () => {
    await T.expectFail({ ...base(), amount: [301, 0, 0, 0, 0, 0, 0, 0] });
  });

  it("fails when the sum exceeds the daily limit", async () => {
    await T.expectFail({ ...base(), amount: [300, 300, 300, 200, 0, 0, 0, 0] });
  });
});
