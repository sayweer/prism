pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";

// Poseidon Merkle inclusion (Tornado-style): proves `leaf` sits at the position
// given by pathIndices under `root`, using the supplied sibling path.
template MerkleInclusion(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component hashers[levels];
    component mux[levels];
    signal hashes[levels + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0; // selector is boolean

        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== hashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== hashes[i];
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        hashes[i + 1] <== hashers[i].out;
    }
    root === hashes[levels];
}

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

    component commit[N];
    component rangeBits[N];
    component leCmp[N];
    component leafHash[N];
    component merkle[N];
    signal sumTerms[N + 1];
    sumTerms[0] <== 0;

    for (var i = 0; i < N; i++) {
        // commitment binding: C_i = Poseidon(amount_i, payee_i, salt_i).
        commit[i] = Poseidon(3);
        commit[i].inputs[0] <== amount[i];
        commit[i].inputs[1] <== payee[i];
        commit[i].inputs[2] <== salt[i];
        commitments[i] === commit[i].out;

        // per-task range: bound the (adversary-controlled) amount BEFORE comparing.
        rangeBits[i] = Num2Bits(nBits);
        rangeBits[i].in <== amount[i];
        leCmp[i] = LessEqThan(nBits);
        leCmp[i].in[0] <== amount[i];
        leCmp[i].in[1] <== perTaskLimit;
        leCmp[i].out === 1;

        sumTerms[i + 1] <== sumTerms[i] + amount[i];

        // whitelist membership: Poseidon(payee_i) must be a leaf under whitelistRoot.
        leafHash[i] = Poseidon(1);
        leafHash[i].inputs[0] <== payee[i];
        merkle[i] = MerkleInclusion(levels);
        merkle[i].leaf <== leafHash[i].out;
        merkle[i].root <== whitelistRoot;
        for (var j = 0; j < levels; j++) {
            merkle[i].pathElements[j] <== pathElements[i][j];
            merkle[i].pathIndices[j] <== pathIndices[i][j];
        }
    }

    // daily limit: bound the total, then compare.
    // Why N<=16 fits nBits+4 bits: each amount is Num2Bits(nBits)-bounded to
    // <= 2^nBits - 1, so total <= N*(2^nBits - 1) = 2^(nBits+4) - N < 2^(nBits+4)
    // at N=16 — a razor-thin margin (N units). For N > 16, widen BOTH the
    // Num2Bits and LessEqThan below to nBits+5 (and re-run this bound).
    signal total;
    total <== sumTerms[N];
    component totalBits = Num2Bits(nBits + 4);
    totalBits.in <== total;
    component dailyCmp = LessEqThan(nBits + 4);
    dailyCmp.in[0] <== total;
    dailyCmp.in[1] <== dailyLimit;
    dailyCmp.out === 1;
}
