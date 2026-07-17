/** Cookie: JSON map of conversationId → lastReadAt ISO string */
export const MSG_READ_COOKIE = "dalily_msg_read";

/** Cookie: short-lived user location for nearby search (never long-term GPS storage) */
export const NEARBY_LOC_COOKIE = "dalily_nearby_loc";

export const NEARBY_LOC_MAX_AGE_SEC = 60 * 30; // 30 minutes

export type NearbyLocPayload = {
  lat: number;
  lng: number;
  /** unix ms when captured */
  at: number;
};

export type MsgReadMap = Record<string, string>;

export function parseMsgReadCookie(raw: string | undefined): MsgReadMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: MsgReadMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value.length > 0) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeMsgReadCookie(map: MsgReadMap): string {
  return encodeURIComponent(JSON.stringify(map));
}

export function parseNearbyLocCookie(raw: string | undefined): NearbyLocPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as NearbyLocPayload;
    if (
      typeof parsed?.lat !== "number" ||
      typeof parsed?.lng !== "number" ||
      !Number.isFinite(parsed.lat) ||
      !Number.isFinite(parsed.lng)
    ) {
      return null;
    }
    // Expire after 30 minutes
    if (typeof parsed.at === "number" && Date.now() - parsed.at > NEARBY_LOC_MAX_AGE_SEC * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function serializeNearbyLocCookie(payload: NearbyLocPayload): string {
  return encodeURIComponent(JSON.stringify(payload));
}
