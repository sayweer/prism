// Single shared StellarWalletsKit instance + connection helpers. Extracted from
// Wallet.tsx so both the wallet view and per-user contract calls drive one kit.
// `walletSignerFor` yields a contract-client signer bound to the connected wallet.
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";
import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";
import { NETWORK_PASSPHRASE } from "../config";
import { makeWalletSigner, type ContractSigner } from "./walletSigner";
import { logFunnel } from "./funnel";

// One-time kit setup. `authModal()` lists these as the available "wallet options".
StellarWalletsKit.init({
  network: Networks.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: [
    new FreighterModule(),
    new xBullModule(),
    new AlbedoModule(),
    new LobstrModule(),
    new RabetModule(),
    new HanaModule(),
  ],
});

// Theme the wallet-select modal to match Prism — dark surface + Stellar-yellow accent.
StellarWalletsKit.setTheme({
  "background": "#0b0b10",
  "background-secondary": "#131319",
  "foreground-strong": "#f3f1ec",
  "foreground": "#e8e6df",
  "foreground-secondary": "#94939c",
  "primary": "#FDDA24",
  "primary-foreground": "#0F0F0F",
  "transparent": "transparent",
  "lighter": "rgba(255,255,255,0.08)",
  "light": "rgba(255,255,255,0.06)",
  "light-gray": "rgba(255,255,255,0.12)",
  "gray": "#56555f",
  "danger": "#FF4D5E",
  "border": "rgba(255,255,255,0.13)",
  "shadow": "rgba(0,0,0,0.6)",
  "border-radius": "16px",
  "font-family": "'Inter', system-ui, sans-serif",
});

export { StellarWalletsKit as kit };

const ADDR_KEY = "prism_wallet_address";
let connectedAddress: string | null =
  typeof sessionStorage !== "undefined" ? sessionStorage.getItem(ADDR_KEY) : null;

// The nav chip and the views all reflect one connection — notify them on change.
type AddressListener = (address: string | null) => void;
const addressListeners = new Set<AddressListener>();
function notifyAddress(): void {
  for (const fn of addressListeners) fn(connectedAddress);
}

/** Subscribe to connect/disconnect changes. Returns an unsubscribe function. */
export function onAddressChange(fn: AddressListener): () => void {
  addressListeners.add(fn);
  return () => {
    addressListeners.delete(fn);
  };
}

/** The currently connected wallet address (persisted across reloads in this tab), or null. */
export function getAddress(): string | null {
  return connectedAddress;
}

/** Open the wallet-select modal and return the chosen address. Throws if none selected.
 *  Funnel-instrumented: a `connect_click` on open, then a `connect_result` — success (a
 *  wallet bound), error (modal rejected, e.g. no compatible wallet / user aborted), or
 *  dismissed (resolved with no wallet). This is what makes the connect-wall drop-off visible. */
export async function connect(): Promise<string> {
  logFunnel({ event: "connect_click" });
  let address: string | undefined;
  try {
    const res = await StellarWalletsKit.authModal();
    address = (res as { address?: string }).address;
    if (address) {
      connectedAddress = address;
      sessionStorage.setItem(ADDR_KEY, address);
      notifyAddress();
      logFunnel({
        event: "connect_result",
        outcome: "success",
        walletId: (res as { walletId?: string }).walletId,
      });
      return address;
    }
  } catch (e) {
    logFunnel({
      event: "connect_result",
      outcome: "error",
      detail: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
  logFunnel({ event: "connect_result", outcome: "dismissed" });
  throw new Error("No wallet selected.");
}

export async function disconnect(): Promise<void> {
  try {
    await StellarWalletsKit.disconnect();
  } catch {
    /* ignore */
  }
  connectedAddress = null;
  sessionStorage.removeItem(ADDR_KEY);
  notifyAddress();
}

/** A contract-client `signTransaction` bound to the connected wallet. */
export function walletSignerFor(address: string): ContractSigner {
  return makeWalletSigner(StellarWalletsKit, address, NETWORK_PASSPHRASE);
}
