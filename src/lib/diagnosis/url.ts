import type { ProblemPriority } from "@/lib/search/engine/types";

/** Single source of truth for the param name — used by both search-form.tsx (write) and search-results.tsx (read). */
export const URGENCY_PARAM = "urgency";

const VALID_PRIORITIES: ProblemPriority[] = ["emergency", "high", "normal", "low"];

export function parseUrgencyOverride(value: string | undefined | null): ProblemPriority | null {
  if (!value) return null;
  return (VALID_PRIORITIES as string[]).includes(value) ? (value as ProblemPriority) : null;
}
