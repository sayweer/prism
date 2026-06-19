// Off-chain Poseidon over BN254 (matches circomlib's in-circuit Poseidon).
import { buildPoseidon } from "circomlibjs";

let _p: any;
export async function poseidon() {
  return (_p ??= await buildPoseidon());
}

/** Poseidon hash returning the result as a bigint field element. */
export async function H(inputs: (bigint | number)[]): Promise<bigint> {
  const p = await poseidon();
  return BigInt(p.F.toString(p(inputs.map((x) => BigInt(x)))));
}
