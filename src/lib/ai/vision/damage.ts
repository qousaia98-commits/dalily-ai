/** Damage taxonomy for Phase-5 vision intelligence. */

import type { DamageSeverity, DetectedDamage } from "./types";

export const VISION_DAMAGE_TYPES = [
  "leak",
  "broken_pipe",
  "rust",
  "crack",
  "burn_marks",
  "water_damage",
  "mold",
  "missing_parts",
  "loose_cables",
  "blocked_drain",
  "corrosion",
  "scorch",
  "chipped_paint",
  "hole",
] as const;

export type VisionDamageType = (typeof VISION_DAMAGE_TYPES)[number];

export const VISION_DAMAGE_MIN_CONFIDENCE = 0.55;

export function normalizeDamageType(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function inferDamageSeverity(
  type: string,
  confidence: number,
): DamageSeverity {
  const t = normalizeDamageType(type);
  if (
    ["burn_marks", "scorch", "loose_cables", "broken_pipe"].some((d) =>
      t.includes(d),
    )
  ) {
    return confidence >= 0.7 ? "critical" : "high";
  }
  if (["leak", "water_damage", "blocked_drain", "mold"].some((d) => t.includes(d))) {
    return confidence >= 0.75 ? "high" : "medium";
  }
  if (["crack", "rust", "corrosion", "chipped_paint"].some((d) => t.includes(d))) {
    return "medium";
  }
  return "low";
}

export function filterHighConfidenceDamages(
  damages: DetectedDamage[],
  minConfidence = VISION_DAMAGE_MIN_CONFIDENCE,
): DetectedDamage[] {
  return damages
    .filter((d) => d.confidence >= minConfidence && d.type.trim().length > 0)
    .map((d) => {
      const type = normalizeDamageType(d.type) || d.type.trim().toLowerCase();
      return {
        ...d,
        type,
        severity: d.severity ?? inferDamageSeverity(type, d.confidence),
      };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

export function riskFromDamages(
  damages: DetectedDamage[],
): "low" | "medium" | "high" {
  if (damages.some((d) => d.severity === "critical")) return "high";
  if (damages.some((d) => d.severity === "high")) return "high";
  if (damages.some((d) => d.severity === "medium")) return "medium";
  return damages.length > 0 ? "low" : "low";
}
