/** Persistent user choice — never stores GPS coordinates */
export const LOC_PREF_COOKIE = "dalily_loc_pref";

export type LocationPreference = "enabled" | "disabled";

export function parseLocationPreference(
  raw: string | undefined,
): LocationPreference | null {
  if (raw === "enabled" || raw === "disabled") return raw;
  return null;
}

export function hasLocationPreferenceSet(raw: string | undefined): boolean {
  return parseLocationPreference(raw) !== null;
}
