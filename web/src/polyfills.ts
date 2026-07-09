// Must be imported FIRST in main.tsx so Buffer exists before @stellar/stellar-sdk loads.
import { Buffer } from "buffer";

declare global {
   
  var Buffer: typeof import("buffer").Buffer;
}

if (!(globalThis as { Buffer?: unknown }).Buffer) {
  (globalThis as { Buffer: typeof Buffer }).Buffer = Buffer;
}
