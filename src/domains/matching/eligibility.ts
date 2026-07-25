import { createAdminClient } from "@/lib/supabase/admin";
import type { MatchReason } from "@/domains/matching/reasons";

export type EligibleProviderCandidate = {
  id: string;
  ownerId: string;
  categoryId: string;
  cityId: string;
  verificationStatus: string;
  ratingAvg: number;
  reviewCount: number;
  acceptingRequests: boolean;
  vacationMode: boolean;
  reasons: MatchReason[];
};

/**
 * Hard eligibility for marketplace request matching.
 * Never loads or sorts by subscription plan.
 */
export async function findEligibleProviderCandidates(input: {
  categoryId: string;
  cityId: string;
  urgency: "emergency" | "normal";
  /** When true, ignore city hard gate (expand-on-failure). */
  expandArea?: boolean;
}): Promise<EligibleProviderCandidate[]> {
  const admin = createAdminClient();

  let query = admin
    .from("providers")
    .select(
      "id, owner_id, category_id, city_id, verification_status, rating_avg, review_count, status, deleted_at",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("category_id", input.categoryId);

  if (!input.expandArea) {
    query = query.eq("city_id", input.cityId);
  }

  const { data: providers, error } = await query.limit(200);
  if (error || !providers?.length) return [];

  const providerIds = providers.map((p) => p.id as string);
  const { data: settingsRows } = await admin
    .from("provider_request_settings")
    .select("provider_id, accepting_requests, vacation_mode")
    .in("provider_id", providerIds);

  const settingsMap = new Map(
    (settingsRows ?? []).map((s) => [
      s.provider_id as string,
      {
        accepting: Boolean(s.accepting_requests),
        vacation: Boolean(s.vacation_mode),
      },
    ]),
  );

  const candidates: EligibleProviderCandidate[] = [];

  for (const p of providers) {
    const id = p.id as string;
    const settings = settingsMap.get(id);
    // Missing settings row → treat as accepting (legacy default on create).
    const accepting = settings ? settings.accepting : true;
    const vacation = settings ? settings.vacation : false;
    if (!accepting || vacation) continue;

    const reasons: MatchReason[] = [
      { code: "category_fit" },
      { code: "active_accepting" },
    ];

    if (!input.expandArea && p.city_id === input.cityId) {
      reasons.push({ code: "city_fit" });
    }
    if (input.expandArea) {
      reasons.push({ code: "expanded_area" });
    }

    // providers.verification_status — "verified" is the go-live trust signal.
    const isVerified = p.verification_status === "verified";

    if (isVerified) {
      reasons.push({ code: "verified" });
      if (input.urgency === "emergency") {
        reasons.push({ code: "emergency_priority" });
      }
    }

    const rating = Number(p.rating_avg ?? 0);
    if (rating >= 4.5) {
      reasons.push({ code: "high_rating", params: { rating } });
    }

    candidates.push({
      id,
      ownerId: p.owner_id as string,
      categoryId: p.category_id as string,
      cityId: p.city_id as string,
      verificationStatus: String(p.verification_status),
      ratingAvg: rating,
      reviewCount: Number(p.review_count ?? 0),
      acceptingRequests: accepting,
      vacationMode: vacation,
      reasons,
    });
  }

  return candidates;
}
