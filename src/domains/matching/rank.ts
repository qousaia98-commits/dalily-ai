import type { EligibleProviderCandidate } from "@/domains/matching/eligibility";
import { MATCHING_POLICY } from "@/domains/matching/policy";
import type { MatchReason } from "@/domains/matching/reasons";

export type RankedAssignment = {
  providerId: string;
  ownerId: string;
  reasons: MatchReason[];
  rank: number;
  source: "initial" | "expand" | "newcomer";
};

/**
 * Rank eligible candidates without subscription influence.
 * Prefer: verified (esp. emergency) → rating → review volume as soft reliability proxy.
 * Reserve newcomer slots inside the cap.
 */
export function selectAssignmentsFromCandidates(
  candidates: EligibleProviderCandidate[],
  opts: {
    urgency: "emergency" | "normal";
    max: number;
    source: "initial" | "expand";
    alreadyAssignedIds?: Set<string>;
  },
): RankedAssignment[] {
  const taken = opts.alreadyAssignedIds ?? new Set<string>();
  const pool = candidates.filter((c) => !taken.has(c.id));

  const score = (c: EligibleProviderCandidate): number => {
    let s = c.ratingAvg * 10 + Math.min(c.reviewCount, 50) * 0.1;
    const verified = c.reasons.some((r) => r.code === "verified");
    if (verified) s += 15;
    if (opts.urgency === "emergency" && verified) s += 10;
    if (c.reasons.some((r) => r.code === "city_fit")) s += 5;
    // Soft demote extreme newcomers slightly so exploration is intentional, not accidental top.
    if (c.reviewCount < MATCHING_POLICY.newcomerReviewThreshold) s -= 2;
    return s;
  };

  const sorted = [...pool].sort((a, b) => score(b) - score(a));

  const newcomers = sorted.filter(
    (c) => c.reviewCount < MATCHING_POLICY.newcomerReviewThreshold,
  );
  const established = sorted.filter(
    (c) => c.reviewCount >= MATCHING_POLICY.newcomerReviewThreshold,
  );

  const selected: RankedAssignment[] = [];
  const pick = (
    c: EligibleProviderCandidate,
    source: RankedAssignment["source"],
  ) => {
    if (selected.some((s) => s.providerId === c.id)) return;
    if (selected.length >= opts.max) return;
    const reasons =
      source === "newcomer"
        ? [...c.reasons, { code: "newcomer_exploration" as const }]
        : c.reasons;
    selected.push({
      providerId: c.id,
      ownerId: c.ownerId,
      reasons,
      rank: selected.length + 1,
      source,
    });
  };

  // Fill mostly from established, then ensure newcomer oxygen.
  for (const c of established) pick(c, opts.source);
  let newcomersAdded = 0;
  for (const c of newcomers) {
    if (newcomersAdded >= MATCHING_POLICY.newcomerMax) break;
    if (selected.length >= opts.max) break;
    pick(c, "newcomer");
    newcomersAdded += 1;
  }
  // If still room, allow more established (or leftover newcomers without exploration tag).
  for (const c of sorted) {
    if (selected.length >= opts.max) break;
    pick(c, opts.source);
  }

  return selected.map((a, i) => ({ ...a, rank: i + 1 }));
}
