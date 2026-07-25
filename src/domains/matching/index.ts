/**
 * SAD Matching domain skeleton (Sprint 0).
 * No runtime matching rewrite yet — Sprint 3.
 */

export const MATCHING_DOMAIN = {
  service: "matching",
  owns: ["match_pools", "match_assignments", "reason_codes"],
  impl: ["src/lib/search/smart-match (salvage later)"],
  status: "skeleton",
  sprint: 3,
} as const;
