// Maps a connected wallet address -> its deployed treasury contract ids, persisted in
// localStorage. This is the MVP lookup; an on-chain registry is a later wave. Cross-device
// access is covered by letting the user paste an existing treasury address in the Workspace.
//
// Schema (new): "prism_treasuries:" + address -> JSON { ids: string[], active: string }
//   `ids` keeps every treasury the wallet deployed/opened here (oldest → newest), so a
//   second deploy no longer overwrites the first one's id; `active` is the one in use.
// Schema (legacy): "prism_treasury:" + address -> a single id string. Read as a fallback
//   and folded into the new record on the first write (the legacy key is then removed,
//   so a later clear can't resurrect a stale id).
const LEGACY_PREFIX = "prism_treasury:";
const PREFIX = "prism_treasuries:";

interface TreasuryRecord {
  ids: string[];
  active: string;
}

function loadRecord(address: string): TreasuryRecord | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(PREFIX + address);
  if (raw) {
    try {
      const rec = JSON.parse(raw) as TreasuryRecord;
      if (
        Array.isArray(rec.ids) &&
        rec.ids.length > 0 &&
        rec.ids.every((id) => typeof id === "string")
      ) {
        return { ids: rec.ids, active: rec.ids.includes(rec.active) ? rec.active : rec.ids[rec.ids.length - 1] };
      }
    } catch {
      // corrupt JSON — treat as absent and fall through to the legacy key
    }
  }
  const legacy = localStorage.getItem(LEGACY_PREFIX + address);
  return legacy ? { ids: [legacy], active: legacy } : null;
}

function saveRecord(address: string, rec: TreasuryRecord): void {
  localStorage.setItem(PREFIX + address, JSON.stringify(rec));
  // The legacy id (if any) is already folded into `rec.ids` by loadRecord.
  localStorage.removeItem(LEGACY_PREFIX + address);
}

/** The wallet's active treasury id, or null if none is known on this device. */
export function getTreasuryId(address: string): string | null {
  return loadRecord(address)?.active ?? null;
}

/** Remember a treasury for this wallet and make it the active one. Ids accumulate —
 *  deploying a second treasury keeps the first one recoverable via listTreasuries. */
export function setTreasuryId(address: string, id: string): void {
  if (typeof localStorage === "undefined") return;
  const rec = loadRecord(address) ?? { ids: [], active: "" };
  if (!rec.ids.includes(id)) rec.ids.push(id);
  rec.active = id;
  saveRecord(address, rec);
}

/** Forget the active treasury; the most recent remaining one (if any) takes over. */
export function clearTreasuryId(address: string): void {
  if (typeof localStorage === "undefined") return;
  const rec = loadRecord(address);
  if (!rec) {
    localStorage.removeItem(PREFIX + address);
    localStorage.removeItem(LEGACY_PREFIX + address);
    return;
  }
  const ids = rec.ids.filter((id) => id !== rec.active);
  if (ids.length === 0) {
    localStorage.removeItem(PREFIX + address);
    localStorage.removeItem(LEGACY_PREFIX + address);
    return;
  }
  saveRecord(address, { ids, active: ids[ids.length - 1] });
}

/** Every treasury this wallet has deployed/opened on this device (oldest → newest). */
export function listTreasuries(address: string): string[] {
  return loadRecord(address)?.ids.slice() ?? [];
}

/** Switch the active treasury to a previously-known id; unknown ids are a no-op
 *  (adding new ids is setTreasuryId's job). */
export function setActiveTreasury(address: string, id: string): void {
  if (typeof localStorage === "undefined") return;
  const rec = loadRecord(address);
  if (rec && rec.ids.includes(id)) {
    saveRecord(address, { ids: rec.ids, active: id });
  }
}
