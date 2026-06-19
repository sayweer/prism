pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

// Prism Confidential — compliance predicate over a fixed batch of N payments.
//
// Proves, WITHOUT revealing amounts or payees:
//   - each amount <= per-task limit          (range proof)
//   - sum of amounts <= daily limit          (aggregate bound)
//   - (Task 3) commitments bind (amount,payee,salt)
//   - (Task 4) each payee is in the whitelist Merkle tree
//
// Public params (limits, whitelistRoot) are trusted inputs chosen by the owner
// and re-checked by the verifying contract; only the private amounts/payees are
// adversary-controlled, so those are the signals we range-bound here.
template Compliance(N, levels, nBits) {
    // ---- public ----
    signal input dailyLimit;
    signal input perTaskLimit;
    signal input whitelistRoot;            // used in Task 4
    signal input periodId;                 // public binding only (ties proof to a period)
    signal input commitments[N];           // used in Task 3

    // ---- private ----
    signal input amount[N];
    signal input payee[N];                 // used in Task 3 / 4
    signal input salt[N];                  // used in Task 3
    signal input pathElements[N][levels];  // used in Task 4
    signal input pathIndices[N][levels];   // used in Task 4

    component rangeBits[N];
    component leCmp[N];
    signal sumTerms[N + 1];
    sumTerms[0] <== 0;

    for (var i = 0; i < N; i++) {
        // per-task range: bound the (adversary-controlled) amount BEFORE comparing.
        rangeBits[i] = Num2Bits(nBits);
        rangeBits[i].in <== amount[i];
        leCmp[i] = LessEqThan(nBits);
        leCmp[i].in[0] <== amount[i];
        leCmp[i].in[1] <== perTaskLimit;
        leCmp[i].out === 1;

        sumTerms[i + 1] <== sumTerms[i] + amount[i];
    }

    // daily limit: bound the total, then compare. N<=16 => total < 2^(nBits+4).
    signal total;
    total <== sumTerms[N];
    component totalBits = Num2Bits(nBits + 4);
    totalBits.in <== total;
    component dailyCmp = LessEqThan(nBits + 4);
    dailyCmp.in[0] <== total;
    dailyCmp.in[1] <== dailyLimit;
    dailyCmp.out === 1;
}
