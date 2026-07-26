/** Known trade objects for Phase-5 vision intelligence. */

import type { DetectedVisionObject, VisionObjectImportance } from "./types";

export const VISION_OBJECT_CATALOG = {
  electrical: [
    "outlet",
    "switch",
    "fuse_box",
    "lamp",
    "cable",
    "wire",
    "breaker",
    "socket",
  ],
  plumbing: [
    "sink",
    "toilet",
    "pipe",
    "faucet",
    "drain",
    "boiler",
    "valve",
    "water_heater",
  ],
  painting: ["wall", "ceiling", "crack", "mold", "damaged_paint", "stain"],
} as const;

/** Minimum confidence to keep a detection. */
export const VISION_OBJECT_MIN_CONFIDENCE = 0.55;

export function normalizeObjectName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function inferTradeHint(objectName: string): string | null {
  const name = normalizeObjectName(objectName);
  for (const [trade, items] of Object.entries(VISION_OBJECT_CATALOG)) {
    if ((items as readonly string[]).some((i) => name.includes(i) || i.includes(name))) {
      return trade;
    }
  }
  return null;
}

export function inferImportance(
  objectName: string,
  damagesMentioned: boolean,
): VisionObjectImportance {
  const name = normalizeObjectName(objectName);
  const primaryHints = [
    "pipe",
    "faucet",
    "outlet",
    "fuse_box",
    "breaker",
    "drain",
    "boiler",
    "cable",
    "wire",
  ];
  if (primaryHints.some((h) => name.includes(h)) || damagesMentioned) {
    return "primary";
  }
  if (["wall", "ceiling", "lamp", "sink", "toilet"].some((h) => name.includes(h))) {
    return "secondary";
  }
  return "context";
}

/**
 * Keep only high-confidence detections; normalize names & importance.
 */
export function filterHighConfidenceObjects(
  objects: DetectedVisionObject[],
  minConfidence = VISION_OBJECT_MIN_CONFIDENCE,
): DetectedVisionObject[] {
  return objects
    .filter((o) => o.confidence >= minConfidence && o.name.trim().length > 0)
    .map((o) => {
      const name = normalizeObjectName(o.name) || o.name.trim().toLowerCase();
      return {
        ...o,
        name,
        tradeHint: o.tradeHint ?? inferTradeHint(name),
        importance: o.importance ?? inferImportance(name, false),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}
