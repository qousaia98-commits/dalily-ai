import type { ProblemPriority } from "@/lib/search/engine/types";

/** Single source of truth for the urgency query param — written by search-form.tsx. */
export const URGENCY_PARAM = "urgency";

const VALID_PRIORITIES: ProblemPriority[] = ["emergency", "high", "normal", "low"];

export function parseUrgencyOverride(value: string | undefined | null): ProblemPriority | null {
  if (!value) return null;
  return (VALID_PRIORITIES as string[]).includes(value) ? (value as ProblemPriority) : null;
}
