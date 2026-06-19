import { Circomkit } from "circomkit";
import { H } from "./helpers.js";

const circomkit = new Circomkit();
const N = 8;
const LEVELS = 8;
const NBITS = 64;

describe("Compliance — range, sum & commitments", function () {
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

  // Build an input whose commitments are the real Poseidon(amount,payee,salt).
  async function build(amount: number[], payee: bigint[], salt: bigint[]) {
    const commitments: bigint[] = [];
    for (let i = 0; i < N; i++) commitments.push(await H([amount[i], payee[i], salt[i]]));
    return {
      dailyLimit: 1000,
      perTaskLimit: 300,
      whitelistRoot: 0,
      periodId: 1,
      commitments,
      amount,
      payee,
      salt,
      pathElements: Array.from({ length: N }, () => Array(LEVELS).fill(0)),
      pathIndices: Array.from({ length: N }, () => Array(LEVELS).fill(0)),
    };
  }

  const AMT = [100, 200, 0, 0, 0, 0, 0, 0];
  const PAYEE = [11n, 22n, 0n, 0n, 0n, 0n, 0n, 0n];
  const SALT = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];

  it("passes a compliant batch", async () => {
    await T.expectPass(await build(AMT, PAYEE, SALT));
  });

  it("fails when one amount exceeds the per-task limit", async () => {
    const b = await build([301, 0, 0, 0, 0, 0, 0, 0], PAYEE, SALT); // commitments recomputed → only range fails
    await T.expectFail(b);
  });

  it("fails when the sum exceeds the daily limit", async () => {
    const b = await build([300, 300, 300, 200, 0, 0, 0, 0], PAYEE, SALT); // 1100 > 1000, only sum fails
    await T.expectFail(b);
  });

  it("fails when a commitment does not match its preimage", async () => {
    const b = await build(AMT, PAYEE, SALT);
    b.commitments[0] = b.commitments[0] + 1n; // tamper: no longer Poseidon(amount,payee,salt)
    await T.expectFail(b);
  });
});
