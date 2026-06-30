// Maps a connected wallet address -> its deployed treasury contract id, persisted in
// localStorage. This is the MVP lookup; an on-chain registry is a later wave. Cross-device
// access is covered by letting the user paste an existing treasury address in the Workspace.
const PREFIX = "prism_treasury:";

export function getTreasuryId(address: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(PREFIX + address);
}

export function setTreasuryId(address: string, id: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PREFIX + address, id);
}

export function clearTreasuryId(address: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(PREFIX + address);
}
