# Prism Confidential — ZK Compliance Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zero-knowledge layer to Prism that proves a batch of agent payments obeyed policy (per-task limit, daily limit, payee whitelist) without revealing amounts or payees, with the Groth16 proof verified on-chain by a Soroban contract on Stellar testnet.

**Architecture:** A Circom circuit expresses the compliance predicate over a fixed batch of N=8 payments; snarkjs produces a Groth16 proof over BLS12-381; a Soroban contract (generated from the verifying key) verifies the proof on-chain via the native `bls12_381_multi_pairing_check` host function and emits a `ComplianceAttested` event. The existing transparent `contracts/treasury/` is untouched and serves as the contrasting "public mode."

**Tech Stack:** Circom 2.1.x + circomlib, snarkjs (Groth16, BLS12-381), circomkit (test harness), circomlibjs (off-chain Poseidon/Merkle), Rust/soroban-sdk 26, `mysteryon88/soroban-verifier-gen`, stellar CLI, TypeScript + `@stellar/stellar-sdk`. Build host: WSL2 (Ubuntu).

## Global Constraints

- **Eligibility:** ZK must be load-bearing AND the project must touch Stellar (verify proofs in a Soroban contract). — copied from spec §1.
- **Proving system:** Groth16 over **BLS12-381** only. Compile with `circom --prime bls12381`. — spec §3.
- **On-chain verifier:** generated from our verifying key with `mysteryon88/soroban-verifier-gen` (BLS12-381 target); cross-reference `stellar/soroban-examples/groth16_verifier` for the host-function call pattern. — spec §3, §5.
- **Batch size:** `N = 8`, fixed; unused slots padded with `amount = 0` to any whitelisted payee. — spec §4.
- **Merkle depth:** `levels = 8` (whitelist up to 256 entries). Hash = Poseidon.
- **Amount bound:** every amount range-bounded to **64 bits** via `Num2Bits(64)` before any comparison; every comparison enforced with `=== 1`. — spec §4 soundness footgun.
- **Public signal layout (order is load-bearing):** `[dailyLimit, perTaskLimit, whitelistRoot, periodId, commitments[0..7]]` = **12 public signals**. — spec §4.
- **Payee field encoding:** a Stellar payee is encoded into one BLS12-381 scalar as `Poseidon(hi, lo)` where `hi`/`lo` are the high/low 16 bytes of its 32-byte raw key (each < 2^128 < r). The whitelist Merkle leaf is `Poseidon(payeeField)`.
- **Build host:** WSL2. Keep `.ptau`/`.zkey` on the WSL filesystem (`~/`, not `/mnt/c/`). Export `NODE_OPTIONS=--max-old-space-size=8192` for setup/proving.
- **Network:** Stellar **testnet only**. Nothing here is audited; do not point at mainnet.
- **Untouched:** `contracts/treasury/` and the existing `web/` stay as-is in this plan. Frontend Confidential Mode panel and Rise In submission are **out of scope** (follow-up phases).
- **README honesty note required** (spec §7): the ZK hides Prism's compliance ledger; transfer-level privacy (token-layer) is explicitly roadmap.
- **Repo:** `C:\Users\l3eki\Desktop\prism` (Windows path). Inside WSL this is `/mnt/c/Users/l3eki/Desktop/prism`. Commit on `main` (repo's established workflow), conventional commits, sign-off footer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

```
circuits/
  package.json                 circomkit + circomlib + circomlibjs deps
  circomkit.json               { protocol: groth16, prime: bls12381 }
  circuits/compliance.circom    Compliance(N, levels, nBits) main circuit
  test/helpers.ts              circomlibjs Poseidon + Merkle tree builders for test inputs
  test/compliance.test.ts      circomkit WitnessTester cases (pass + each violation fails)
  inputs/sample.json           a known-good full input (used to mint the contract fixture)
contracts/compliance_verifier/
  Cargo.toml                   soroban-sdk 26 contract crate (added to workspace)
  src/lib.rs                   verify() wrapper + ComplianceAttested event (wraps generated verifier)
  src/verifier_gen.rs          output of soroban-verifier-gen (the pairing verifier + embedded VK)
  src/test.rs                  cargo tests: valid fixture → attested; tampered → trap
packages/prover/
  package.json
  src/encode.ts                snarkjs proof + publicSignals → Soroban byte args (per verifier-gen layout)
  src/prove.ts                 build witness from a payment batch, run groth16 prove, emit proof+public
  src/submit.ts                submit compliance_verifier.verify(...) tx to testnet, print Stellar Expert link
  src/index.ts                 CLI glue
build/                          .gitignored: pot/zkey/vkey/wasm artifacts
DEPLOYMENT.md                  add verifier contract id + sample verify tx hash
README.md                      add "Prism Confidential" section + honesty note
Cargo.toml                     workspace: add contracts/compliance_verifier member
```

---

### Task 1: Toolchain bootstrap + end-to-end smoke proof (WSL2)

De-risks the entire pipeline before touching the real circuit: prove the WSL toolchain can compile a BLS12-381 circuit and verify a proof off-chain.

**Files:**
- Create: `build/` (gitignored), a throwaway `~/zk-smoke/square.circom` in WSL home
- Modify: `.gitignore` (add `build/`, `circuits/node_modules/`, `**/*.zkey`, `**/*.ptau`, `**/*.wasm`)

**Interfaces:**
- Produces: a working WSL toolchain (`circom`, `snarkjs`, Rust, `stellar`), confirmed by an off-chain `snarkjs groth16 verify` PASS. No code consumed by later tasks except the verified-working environment.

- [ ] **Step 1: Ensure WSL2 Ubuntu is present**

Run (PowerShell): `wsl -l -v`
Expected: a `Ubuntu` distro listed as `Version 2`. If absent: `wsl --install -d Ubuntu`, reboot, set a UNIX user.

- [ ] **Step 2: Install Rust + circom + snarkjs in WSL**

Run (WSL bash):
```bash
sudo apt-get update && sudo apt-get install -y build-essential git curl
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
git clone https://github.com/iden3/circom.git ~/circom && cd ~/circom
cargo build --release && cargo install --path circom
# Node 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
. ~/.nvm/nvm.sh && nvm install 20 && nvm use 20
npm i -g snarkjs@latest
```
Expected: `circom --version` prints `2.1.x`; `snarkjs --version` prints `0.7.x`.

- [ ] **Step 3: Install the stellar CLI + wasm target in WSL**

Run (WSL bash):
```bash
rustup target add wasm32-unknown-unknown
cargo install --locked stellar-cli
stellar --version
```
Expected: prints a stellar-cli version. (Used in Task 6/7.)

- [ ] **Step 4: Write a toy circuit**

Create `~/zk-smoke/square.circom`:
```circom
pragma circom 2.1.6;
template Square() {
    signal input x;          // private
    signal output y;
    y <== x * x;
}
component main = Square();
```

- [ ] **Step 5: Compile, set up, prove, verify off-chain**

Run (WSL bash, in `~/zk-smoke`):
```bash
export NODE_OPTIONS=--max-old-space-size=8192
circom square.circom --r1cs --wasm --prime bls12381 -o .
snarkjs powersoftau new bls12-381 12 pot12_0.ptau -v
snarkjs powersoftau prepare phase2 pot12_0.ptau pot12.ptau -v
snarkjs groth16 setup square.r1cs pot12.ptau square_0.zkey
echo '{"x": 7}' > input.json
node square_js/generate_witness.js square_js/square.wasm input.json witness.wtns
snarkjs groth16 prove square_0.zkey witness.wtns proof.json public.json
snarkjs zkey export verificationkey square_0.zkey vkey.json
snarkjs groth16 verify vkey.json public.json proof.json
```
Expected final line: `[INFO]  snarkJS: OK!`

- [ ] **Step 6: Commit the env scaffolding**

```bash
cd /mnt/c/Users/l3eki/Desktop/prism
git add .gitignore
git commit -m "chore(zk): gitignore zk build artifacts; toolchain verified on WSL2

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Compliance circuit — range + daily-sum constraints (TDD)

First real circuit increment: amounts only. Proves each amount ≤ per-task limit and Σ amounts ≤ daily limit, with mandatory `Num2Bits` bounding.

**Files:**
- Create: `circuits/package.json`, `circuits/circomkit.json`, `circuits/circuits/compliance.circom`, `circuits/test/helpers.ts`, `circuits/test/compliance.test.ts`

**Interfaces:**
- Produces: `Compliance(N, levels, nBits)` template with public inputs `dailyLimit, perTaskLimit` and private `amount[N]`. Later tasks extend the SAME template with `commitments`, `whitelistRoot`, `payee`, `salt`, Merkle inputs.

- [ ] **Step 1: Scaffold circuits workspace**

Create `circuits/package.json`:
```json
{
  "name": "prism-circuits",
  "private": true,
  "type": "module",
  "scripts": { "test": "mocha --import=tsx test/**/*.test.ts --timeout 120000" },
  "devDependencies": {
    "circomkit": "^0.3.2",
    "circomlib": "^2.0.5",
    "circomlibjs": "^0.1.7",
    "mocha": "^10.7.3",
    "tsx": "^4.19.0",
    "chai": "^4.5.0",
    "@types/mocha": "^10.0.7"
  }
}
```
Create `circuits/circomkit.json`:
```json
{ "protocol": "groth16", "prime": "bls12381", "dirCircuits": "circuits", "dirBuild": "build", "verbose": false }
```
Run (WSL, in `circuits/`): `npm install`
Expected: installs without error.

- [ ] **Step 2: Write the failing test (range + sum)**

Create `circuits/test/helpers.ts`:
```ts
import { buildPoseidon } from "circomlibjs";
let _p: any;
export async function poseidon() { return _p ??= await buildPoseidon(); }
export async function H(inputs: (bigint|number)[]) {
  const p = await poseidon();
  return BigInt(p.F.toString(p(inputs.map(BigInt))));
}
```
Create `circuits/test/compliance.test.ts`:
```ts
import { Circomkit } from "circomkit";
const circomkit = new Circomkit();
const N = 8, LEVELS = 8, NBITS = 64;

describe("Compliance — range & sum", function () {
  let T: any;
  before(async () => {
    T = await circomkit.WitnessTester("compliance", {
      file: "compliance", template: "Compliance", params: [N, LEVELS, NBITS],
      pubs: ["dailyLimit", "perTaskLimit", "whitelistRoot", "periodId", "commitments"],
    });
  });
  // minimal input where only amounts matter; commitments/merkle filled in later tasks.
  // For THIS task the circuit only constrains amounts, so pass zeros for not-yet-used signals.
  const base = () => ({
    dailyLimit: 1000, perTaskLimit: 300, whitelistRoot: 0, periodId: 1,
    commitments: Array(N).fill(0),
    amount: [100, 200, 0, 0, 0, 0, 0, 0],
    payee: Array(N).fill(0), salt: Array(N).fill(0),
    pathElements: Array(N).fill(Array(LEVELS).fill(0)),
    pathIndices: Array(N).fill(Array(LEVELS).fill(0)),
  });
  it("passes a compliant batch", async () => { await T.expectPass(base()); });
  it("fails when one amount exceeds per-task limit", async () => {
    await T.expectFail({ ...base(), amount: [301, 0, 0, 0, 0, 0, 0, 0] });
  });
  it("fails when the sum exceeds the daily limit", async () => {
    await T.expectFail({ ...base(), amount: [300, 300, 300, 200, 0, 0, 0, 0] }); // 1100 > 1000
  });
});
```
> NOTE: in this task the circuit must NOT yet constrain commitments/merkle, or the zero placeholders above would fail. Those constraints arrive in Tasks 3–4, where these test inputs get real values via `helpers.ts`.

- [ ] **Step 3: Run test, verify it fails (no circuit yet)**

Run (WSL, `circuits/`): `npm test`
Expected: FAIL — circomkit cannot find `compliance` circuit / template.

- [ ] **Step 4: Write the minimal circuit (range + sum only)**

Create `circuits/circuits/compliance.circom`:
```circom
pragma circom 2.1.6;
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

template Compliance(N, levels, nBits) {
    // public
    signal input dailyLimit;
    signal input perTaskLimit;
    signal input whitelistRoot;     // unused until Task 4
    signal input periodId;          // public binding only
    signal input commitments[N];    // unused until Task 3
    // private
    signal input amount[N];
    signal input payee[N];          // unused until Task 3
    signal input salt[N];           // unused until Task 3
    signal input pathElements[N][levels]; // unused until Task 4
    signal input pathIndices[N][levels];  // unused until Task 4

    component rangeBits[N];
    component leCmp[N];
    signal sumTerms[N + 1];
    sumTerms[0] <== 0;

    for (var i = 0; i < N; i++) {
        rangeBits[i] = Num2Bits(nBits);
        rangeBits[i].in <== amount[i];           // bound BEFORE compare
        leCmp[i] = LessEqThan(nBits);
        leCmp[i].in[0] <== amount[i];
        leCmp[i].in[1] <== perTaskLimit;
        leCmp[i].out === 1;
        sumTerms[i + 1] <== sumTerms[i] + amount[i];
    }

    signal total;
    total <== sumTerms[N];
    component totalBits = Num2Bits(nBits + 4);
    totalBits.in <== total;
    component dailyCmp = LessEqThan(nBits + 4);
    dailyCmp.in[0] <== total;
    dailyCmp.in[1] <== dailyLimit;
    dailyCmp.out === 1;
}

component main {public [dailyLimit, perTaskLimit, whitelistRoot, periodId, commitments]} = Compliance(8, 8, 64);
```
> circom will warn that some inputs are unused — expected at this stage; Tasks 3–4 wire them.

- [ ] **Step 5: Run test, verify it passes**

Run (WSL, `circuits/`): `npm test`
Expected: 3 passing (compliant passes; per-task overflow fails; daily overflow fails).

- [ ] **Step 6: Commit**

```bash
git add circuits/
git commit -m "feat(zk): compliance circuit with per-task range + daily-sum bounds

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Circuit — commitment binding (Poseidon) (TDD)

Bind each public commitment to its hidden `(amount, payee, salt)`.

**Files:**
- Modify: `circuits/circuits/compliance.circom`, `circuits/test/compliance.test.ts`, `circuits/test/helpers.ts`

**Interfaces:**
- Consumes: `Compliance(N, levels, nBits)` from Task 2.
- Produces: constraint `commitments[i] === Poseidon(amount[i], payee[i], salt[i])`. Test inputs now compute real commitments via `helpers.H`.

- [ ] **Step 1: Add a failing commitment test**

In `circuits/test/compliance.test.ts`, replace `base()` so commitments are computed, and add a tamper case:
```ts
import { H } from "./helpers.js";
async function base() {
  const amount = [100, 200, 0, 0, 0, 0, 0, 0];
  const payee  = [11n, 22n, 0n, 0n, 0n, 0n, 0n, 0n];   // field-encoded placeholder payees
  const salt   = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
  const commitments = [];
  for (let i = 0; i < 8; i++) commitments.push(await H([amount[i], payee[i], salt[i]]));
  return {
    dailyLimit: 1000, perTaskLimit: 300, whitelistRoot: 0, periodId: 1,
    commitments, amount, payee, salt,
    pathElements: Array(8).fill(Array(8).fill(0)),
    pathIndices: Array(8).fill(Array(8).fill(0)),
  };
}
it("fails when a commitment does not match its preimage", async () => {
  const b = await base(); b.commitments[0] = b.commitments[0] + 1n;
  await T.expectFail(b);
});
```
Update the existing three tests to `await base()`.

- [ ] **Step 2: Run, verify the tamper test fails to prove (i.e. test currently errors because circuit ignores commitments)**

Run (WSL, `circuits/`): `npm test`
Expected: the tamper test FAILS (circuit still ignores commitments, so the bad input wrongly passes).

- [ ] **Step 3: Add the commitment constraint**

In `compliance.circom`, add `include "circomlib/circuits/poseidon.circom";` and inside the loop:
```circom
    component commit[N];
    // ... inside the for-loop, before sumTerms:
        commit[i] = Poseidon(3);
        commit[i].inputs[0] <== amount[i];
        commit[i].inputs[1] <== payee[i];
        commit[i].inputs[2] <== salt[i];
        commitments[i] === commit[i].out;
```

- [ ] **Step 4: Run, verify all pass**

Run: `npm test`
Expected: all passing incl. the tamper case now failing-to-prove as required.

- [ ] **Step 5: Commit**

```bash
git add circuits/
git commit -m "feat(zk): bind public commitments to (amount,payee,salt) via Poseidon

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Circuit — Merkle whitelist membership (TDD)

Each payee must be a member of the committed whitelist. Padding slots reuse a real whitelisted payee with `amount = 0`.

**Files:**
- Modify: `circuits/circuits/compliance.circom`, `circuits/test/helpers.ts`, `circuits/test/compliance.test.ts`, create `circuits/inputs/sample.json`

**Interfaces:**
- Consumes: the Task 3 circuit.
- Produces: constraint that `Poseidon(payee[i])` has a valid Merkle path to `whitelistRoot`. `helpers.ts` gains `buildTree(payees)` returning `{root, pathFor(index)}`.

- [ ] **Step 1: Add Merkle helpers**

Append to `circuits/test/helpers.ts`:
```ts
export async function leaf(payeeField: bigint) { return H([payeeField]); }
// Fixed-depth Poseidon Merkle tree (depth=levels), zero-filled.
export async function buildTree(payees: bigint[], levels = 8) {
  let layer: bigint[] = [];
  for (const p of payees) layer.push(await leaf(p));
  const ZERO = 0n;
  while (layer.length < (1 << levels)) layer.push(await H([ZERO]));
  const layers = [layer];
  for (let l = 0; l < levels; l++) {
    const cur = layers[l], next: bigint[] = [];
    for (let i = 0; i < cur.length; i += 2) next.push(await H([cur[i], cur[i + 1]]));
    layers.push(next);
  }
  const root = layers[levels][0];
  const pathFor = (index: number) => {
    const els: bigint[] = [], idx: number[] = []; let j = index;
    for (let l = 0; l < levels; l++) {
      const sib = j ^ 1; els.push(layers[l][sib]); idx.push(j & 1); j >>= 1;
    }
    return { pathElements: els, pathIndices: idx };
  };
  return { root, pathFor };
}
```

- [ ] **Step 2: Rewrite `base()` to use a real tree + add a non-member failing test**

In `compliance.test.ts`:
```ts
import { buildTree } from "./helpers.js";
async function base() {
  const payee = [11n, 22n, 0n, 0n, 0n, 0n, 0n, 0n].map((x,i)=> x===0n ? 11n : x); // pad → member 11n
  const amount = [100, 200, 0, 0, 0, 0, 0, 0];
  const salt = [1n,2n,3n,4n,5n,6n,7n,8n];
  const tree = await buildTree([11n, 22n, 33n]);   // whitelist
  const commitments = [];
  const pathElements = [], pathIndices = [];
  const indexOf: Record<string, number> = { "11": 0, "22": 1 };
  for (let i = 0; i < 8; i++) {
    commitments.push(await H([amount[i], payee[i], salt[i]]));
    const pi = tree.pathFor(indexOf[payee[i].toString()]);
    pathElements.push(pi.pathElements); pathIndices.push(pi.pathIndices);
  }
  return { dailyLimit:1000, perTaskLimit:300, whitelistRoot: tree.root, periodId:1,
           commitments, amount, payee, salt, pathElements, pathIndices };
}
it("fails when a payee is not in the whitelist", async () => {
  const b = await base(); b.payee[0] = 99n; b.commitments[0] = await H([b.amount[0], 99n, b.salt[0]]);
  await T.expectFail(b);   // 99n has no valid path to root
});
```

- [ ] **Step 3: Run, verify the non-member test currently (wrongly) passes**

Run: `npm test` → the non-member case FAILS the suite (circuit ignores merkle), confirming the gap.

- [ ] **Step 4: Add the Merkle inclusion template + wiring**

Prepend the inclusion template (above `template Compliance`) and add `include "circomlib/circuits/mux1.circom";`:
```circom
template MerkleInclusion(levels) {
    signal input leaf; signal input root;
    signal input pathElements[levels]; signal input pathIndices[levels];
    component hashers[levels]; component mux[levels];
    signal hashes[levels + 1]; hashes[0] <== leaf;
    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;
        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== hashes[i];        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];  mux[i].c[1][1] <== hashes[i];
        mux[i].s <== pathIndices[i];
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0]; hashers[i].inputs[1] <== mux[i].out[1];
        hashes[i + 1] <== hashers[i].out;
    }
    root === hashes[levels];
}
```
Inside `Compliance`'s loop add:
```circom
    component leafHash[N]; component merkle[N];
    // ... in the for-loop:
        leafHash[i] = Poseidon(1); leafHash[i].inputs[0] <== payee[i];
        merkle[i] = MerkleInclusion(levels);
        merkle[i].leaf <== leafHash[i].out; merkle[i].root <== whitelistRoot;
        for (var j = 0; j < levels; j++) {
            merkle[i].pathElements[j] <== pathElements[i][j];
            merkle[i].pathIndices[j]  <== pathIndices[i][j];
        }
```

- [ ] **Step 5: Run, verify all pass; persist a sample input**

Run: `npm test` → all passing.
Then dump one good input for later fixtures: add a `it.only`-free helper or copy a printed `base()` into `circuits/inputs/sample.json` (real numbers, no placeholders).

- [ ] **Step 6: Commit**

```bash
git add circuits/
git commit -m "feat(zk): enforce payee whitelist via Poseidon Merkle inclusion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Trusted setup + off-chain verification (the real circuit)

Produce the Groth16 keys and a real proof; lock the off-chain fallback path.

**Files:**
- Create: `circuits/scripts/setup.sh`, `build/compliance.zkey`, `build/compliance_vkey.json`, `build/proof.json`, `build/public.json` (all gitignored except the script)

**Interfaces:**
- Produces: `build/compliance_vkey.json` (input to Task 6's verifier generation) and a `(proof.json, public.json)` pair that `snarkjs groth16 verify` accepts (the contract fixture in Task 6 reuses these).

- [ ] **Step 1: Write the setup script**

Create `circuits/scripts/setup.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
export NODE_OPTIONS=--max-old-space-size=8192
cd "$(dirname "$0")/.."
npx circomkit compile compliance                 # emits build/compliance/compliance.{r1cs,wasm}
R1CS=build/compliance/compliance.r1cs
snarkjs powersoftau new bls12-381 16 build/pot16_0.ptau -v
snarkjs powersoftau prepare phase2 build/pot16_0.ptau build/pot16.ptau -v
snarkjs groth16 setup "$R1CS" build/pot16.ptau build/compliance.zkey
snarkjs zkey export verificationkey build/compliance.zkey build/compliance_vkey.json
```
> Power `16` covers this circuit (8×(Poseidon+Merkle depth-8) is well under 2^16 constraints; if `snarkjs` reports "too many constraints", bump to 17).

- [ ] **Step 2: Run setup**

Run (WSL, `circuits/`): `bash scripts/setup.sh`
Expected: produces `build/compliance.zkey` and `build/compliance_vkey.json` with no error.

- [ ] **Step 3: Generate a proof from the sample input + verify off-chain**

Run (WSL, `circuits/`):
```bash
node build/compliance/compliance_js/generate_witness.js \
  build/compliance/compliance_js/compliance.wasm inputs/sample.json build/witness.wtns
snarkjs groth16 prove build/compliance.zkey build/witness.wtns build/proof.json build/public.json
snarkjs groth16 verify build/compliance_vkey.json build/public.json build/proof.json
```
Expected final line: `[INFO]  snarkJS: OK!` and `build/public.json` is an array of **12** decimal strings.

- [ ] **Step 4: Commit the script only**

```bash
git add circuits/scripts/setup.sh
git commit -m "feat(zk): groth16 trusted setup + off-chain verify pipeline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Soroban `compliance_verifier` contract + attestation (cargo test)

Generate the on-chain verifier from the VK, wrap it with `verify()` + a `ComplianceAttested` event, and test against the real proof fixture.

**Files:**
- Create: `contracts/compliance_verifier/Cargo.toml`, `src/verifier_gen.rs`, `src/lib.rs`, `src/test.rs`
- Modify: root `Cargo.toml` (add workspace member)

**Interfaces:**
- Consumes: `build/compliance_vkey.json`, `build/proof.json`, `build/public.json` from Task 5.
- Produces: contract fn `verify(env, proof: Bytes, public_inputs: Vec<U256>) -> ()` that traps on an invalid proof and emits `("attested", period_id)` → `(whitelist_root)` on success. Task 7 calls this on testnet.

- [ ] **Step 1: Generate the verifier crate from the VK**

Run (WSL): `cargo install soroban-verifier-gen` then
```bash
soroban-verifier-gen --curve bls12381 \
  --vk circuits/build/compliance_vkey.json \
  --out contracts/compliance_verifier/src/verifier_gen.rs
```
> Read `https://github.com/mysteryon88/soroban-verifier-gen` README for the exact flag names and the **expected proof/public byte layout** — this is the canonical source for how `verify` consumes its arguments. Match Task 7's encoder to it. Expected output: a `verifier_gen.rs` exposing a `verify_proof(env, proof, public_signals) -> bool` (or equivalent) with the VK embedded.

- [ ] **Step 2: Write the failing contract test**

Create `contracts/compliance_verifier/src/test.rs` (fixture bytes pasted from Task 5 artifacts via a small encode step in Task 7, or hand-encoded per verifier-gen layout):
```rust
#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Bytes};

// PROOF_BYTES / PUBLIC_BYTES: generated from build/proof.json + build/public.json
// using packages/prover encode step (Task 7). Paste the hex fixtures here.
const PROOF_HEX: &str = include_str!("../fixtures/proof.hex");
const PUBLIC_HEX: &str = include_str!("../fixtures/public.hex");

#[test]
fn valid_proof_attests() {
    let env = Env::default();
    let id = env.register(ComplianceVerifier, ());
    let c = ComplianceVerifierClient::new(&env, &id);
    let proof = Bytes::from_hex(&env, PROOF_HEX);
    let public = Bytes::from_hex(&env, PUBLIC_HEX);
    c.verify(&proof, &public);                       // must NOT trap
    assert!(env.events().all().len() >= 1);          // ComplianceAttested emitted
}

#[test]
#[should_panic]
fn tampered_proof_traps() {
    let env = Env::default();
    let id = env.register(ComplianceVerifier, ());
    let c = ComplianceVerifierClient::new(&env, &id);
    let mut bad = PROOF_HEX.to_string(); bad.replace_range(0..2, "ff");
    let proof = Bytes::from_hex(&env, &bad);
    let public = Bytes::from_hex(&env, PUBLIC_HEX);
    c.verify(&proof, &public);                       // expected to trap
}
```
> `fixtures/proof.hex` + `fixtures/public.hex` are written by Task 7's `encode.ts`; if executing strictly in order, run that encode step early (it only needs Task 5 artifacts) and drop the two files in `contracts/compliance_verifier/fixtures/`.

- [ ] **Step 3: Run, verify it fails to compile/contract-missing**

Run (WSL): `cargo test -p compliance_verifier`
Expected: FAIL — `ComplianceVerifier` not defined.

- [ ] **Step 4: Write `lib.rs` wrapping the generated verifier**

Create `contracts/compliance_verifier/src/lib.rs`:
```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Bytes, Env};
mod verifier_gen;
#[cfg(test)] mod test;

#[contract]
pub struct ComplianceVerifier;

#[contractimpl]
impl ComplianceVerifier {
    /// Verify a Groth16 compliance proof on-chain. Traps on an invalid proof.
    /// On success, emits ComplianceAttested(period_id) -> (whitelist_root).
    pub fn verify(env: Env, proof: Bytes, public_inputs: Bytes) {
        let ok = verifier_gen::verify_proof(&env, &proof, &public_inputs);
        if !ok { panic!("invalid proof"); }
        // public layout: [dailyLimit, perTaskLimit, whitelistRoot, periodId, C0..C7]
        let (whitelist_root, period_id) = verifier_gen::read_public(&env, &public_inputs, 2, 3);
        env.events().publish((symbol_short!("attested"), period_id), whitelist_root);
    }
}
```
Create `contracts/compliance_verifier/Cargo.toml`:
```toml
[package]
name = "compliance_verifier"
version = "0.1.0"
edition = "2021"
[lib]
crate-type = ["cdylib", "rlib"]
[dependencies]
soroban-sdk = "26"
[dev-dependencies]
soroban-sdk = { version = "26", features = ["testutils"] }
```
Add to root `Cargo.toml` `[workspace] members`: `"contracts/compliance_verifier"`.
> Adapt `verify_proof` / `read_public` names to whatever `soroban-verifier-gen` actually emits (Step 1). If it exposes a single `verify(proof, pub_signals: Vec<U256>)`, decode `public_inputs` Bytes → `Vec<U256>` (32-byte big-endian chunks) and index `[2]` and `[3]`.

- [ ] **Step 5: Run, verify tests pass**

Run (WSL): `cargo test -p compliance_verifier`
Expected: `valid_proof_attests` PASS, `tampered_proof_traps` PASS (panics as expected).

- [ ] **Step 6: Commit**

```bash
git add contracts/compliance_verifier Cargo.toml
git commit -m "feat(contract): on-chain Groth16 compliance verifier + attestation event

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Prover package — serialization bridge + on-chain testnet verify

The highest-risk task. Convert snarkjs output to the verifier's byte format and prove it on real testnet (the killer demo).

**Files:**
- Create: `packages/prover/package.json`, `src/encode.ts`, `src/prove.ts`, `src/submit.ts`, `src/index.ts`; `contracts/compliance_verifier/fixtures/{proof.hex,public.hex}`

**Interfaces:**
- Consumes: `build/proof.json`, `build/public.json`, `build/compliance_vkey.json`, the deployed `compliance_verifier` contract id, the Task-5 circuit wasm/zkey.
- Produces: a confirmed testnet `verify` transaction hash + Stellar Expert link.

- [ ] **Step 1: Scaffold + encoder**

Create `packages/prover/package.json`:
```json
{ "name": "prism-prover", "private": true, "type": "module",
  "dependencies": { "@stellar/stellar-sdk": "^13", "snarkjs": "^0.7.6" },
  "devDependencies": { "tsx": "^4.19.0", "typescript": "^5.6.0" } }
```
Create `packages/prover/src/encode.ts` — convert snarkjs JSON → the exact byte layout `soroban-verifier-gen` expects (per its README from Task 6 Step 1):
```ts
// Big-endian fixed-width field/group encoding. CRITICAL per spec §risk:
//  - G2 Fp2 inner component order is (c1, c0) in Soroban, but snarkjs nests [c0, c1] → swap.
//  - Negate A (or apply the verifier-gen's documented sign convention).
//  - 48-byte Fp, 96-byte G1 (x||y), 192-byte G2.
// PREFER the encoder helper shipped/generated by soroban-verifier-gen over hand-rolling.
export function encodeProof(proofJson: any): Buffer { /* follow verifier-gen layout */ throw new Error("wire to verifier-gen encoder"); }
export function encodePublic(publicJson: string[]): Buffer {
  // 12 signals × 32-byte big-endian
  return Buffer.concat(publicJson.map(s => {
    const b = Buffer.alloc(32); const hex = BigInt(s).toString(16).padStart(64, "0");
    Buffer.from(hex, "hex").copy(b); return b;
  }));
}
```
> Do NOT invent the proof byte order. Use the encoder that `soroban-verifier-gen` provides (it generated the verifier, so it owns the canonical layout). `jamesbachini/CircomStellar` is a working second reference for the snarkjs→Soroban byte conversion if needed.

- [ ] **Step 2: Emit the contract fixtures (also unblocks Task 6 tests)**

Create `packages/prover/src/index.ts` to write fixtures:
```ts
import { readFileSync, writeFileSync } from "node:fs";
import { encodeProof, encodePublic } from "./encode.js";
const proof = JSON.parse(readFileSync("../../circuits/build/proof.json", "utf8"));
const pub = JSON.parse(readFileSync("../../circuits/build/public.json", "utf8"));
writeFileSync("../../contracts/compliance_verifier/fixtures/proof.hex", encodeProof(proof).toString("hex"));
writeFileSync("../../contracts/compliance_verifier/fixtures/public.hex", encodePublic(pub).toString("hex"));
console.log("fixtures written");
```
Run (WSL, `packages/prover/`): `npm install && npx tsx src/index.ts`
Expected: `fixtures written`; the two `.hex` files exist. (Now Task 6 tests have real fixtures.)

- [ ] **Step 3: Deploy the verifier to testnet**

Run (WSL):
```bash
stellar keys generate zk-deployer --network testnet --fund
stellar contract build --manifest-path contracts/compliance_verifier/Cargo.toml
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/compliance_verifier.wasm \
  --source zk-deployer --network testnet
```
Expected: prints a contract id `C...`. Record it (used below + in DEPLOYMENT.md).

- [ ] **Step 4: Submit the verify tx on-chain**

Create `packages/prover/src/submit.ts` using `@stellar/stellar-sdk` to invoke `verify(proof, public_inputs)` with the encoded bytes against the deployed id, signed by `zk-deployer`, on `https://soroban-testnet.stellar.org`. Then run it.
Run (WSL, `packages/prover/`): `npx tsx src/submit.ts <CONTRACT_ID>`
Expected: a successful tx hash; verification did not trap.

- [ ] **Step 5: Confirm on Stellar Expert**

Open `https://stellar.expert/explorer/testnet/tx/<HASH>`
Expected: the transaction shows a successful `verify` invocation with a `attested` contract event. **This is the on-chain proof for the submission.**

- [ ] **Step 6: Commit**

```bash
git add packages/prover contracts/compliance_verifier/fixtures
git commit -m "feat(prover): snarkjs->Soroban encoder + on-chain testnet verification

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: README + DEPLOYMENT docs (confidential layer + honesty note)

Make the build legible to judges; record on-chain proofs.

**Files:**
- Modify: `README.md`, `DEPLOYMENT.md`

**Interfaces:**
- Consumes: the verifier contract id + verify tx hash from Task 7.

- [ ] **Step 1: Add the "Prism Confidential" section to README**

Insert after the existing "What Prism does" table a section describing: the confidential mode, the proven statement (per-task ≤, Σ ≤ daily, payee ∈ whitelist), on-chain Groth16 verification on Soroban, and the **honesty note verbatim** from spec §7 (ZK hides Prism's compliance ledger; transfer-level privacy is roadmap). Link the verify tx on Stellar Expert.

- [ ] **Step 2: Record addresses in DEPLOYMENT.md**

Add a row: `Compliance Verifier | C... | <verify tx hash / Stellar Expert link>`.

- [ ] **Step 3: Commit**

```bash
git add README.md DEPLOYMENT.md
git commit -m "docs: document Prism Confidential ZK layer + on-chain proof, with honesty note

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §3 toolchain (Circom+Groth16/BLS12-381) → Tasks 1,5. ✓
- §4 proven statement (commitment, range, sum, Merkle; 12 public signals; Num2Bits bounding) → Tasks 2,3,4. ✓
- §5 components (circuit, verifier contract, prover; treasury untouched) → Tasks 2–7. ✓
- §5 on-chain verifier forked/generated + attestation gate → Task 6. ✓
- §6 data flow (witness→proof→serialize→verify→event) → Tasks 5,6,7. ✓
- §7 honesty note → Task 8. ✓
- §8 verification criteria (circuit pass/fail cases, cargo test valid+invalid, real testnet verify tx, off-chain fallback) → Tasks 2–7. ✓
- §9 risks (serialization, WSL, soundness bounding) → Task 7 (delegated encoder), Task 1 (WSL), Tasks 2–4 (Num2Bits). ✓
- §2 deferred frontend + Rise In → intentionally excluded. ✓

**Placeholder scan:** `encode.ts::encodeProof` is intentionally delegated to the `soroban-verifier-gen`/CircomStellar layout (the canonical owner of the byte order) rather than fabricated — this is a deliberate "follow the upstream spec" pointer, not a TODO; the encoder's correctness is the explicit subject of Task 7 and gated by the on-chain verify in Step 4–5.

**Type consistency:** public-signal order `[dailyLimit, perTaskLimit, whitelistRoot, periodId, commitments[8]]` (12 signals) is identical across the circuit `main` (Task 2/4), `public.json` (Task 5), the contract's `read_public` indices `[2]=whitelistRoot, [3]=periodId` (Task 6), and `encodePublic` (Task 7). `Compliance(8,8,64)` params consistent across Tasks 2–5. ✓

---

## Open execution risk (call out before starting)

The single point that can break the on-chain demo is the **snarkjs→Soroban byte encoding** (Task 7 Step 1–4). Mitigation order: (1) use `soroban-verifier-gen`'s own encoder; (2) fall back to `jamesbachini/CircomStellar`'s encoder; (3) if both slip before the deadline, ship the **off-chain `snarkjs groth16 verify`** path (already green at Task 5) and present on-chain verification as "wired, pending byte-order fix" — honestly, per the hackathon's stated preference. The ZK stays load-bearing either way.
