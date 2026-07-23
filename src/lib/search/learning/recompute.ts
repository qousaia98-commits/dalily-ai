import { createAdminClient } from "@/lib/supabase/admin";
import { getActivePlanSlugsByProviderIds } from "@/lib/subscription/repository";
import { computeProviderPerformance } from "./performance-score";
import { upsertCustomerPreferences, upsertProviderPerformance } from "./repository";
import type { CustomerPreferenceProfile } from "./types";

/**
 * Recompute one provider's AI Performance Score from live marketplace data.
 * Fire-and-forget safe — never blocks the request workflow.
 */
export async function recomputeProviderPerformance(
  providerId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: provider, error: pErr } = await admin
      .from("providers")
      .select(
        "id, verification_status, profile_completeness, rating_avg, review_count",
      )
      .eq("id", providerId)
      .maybeSingle();

    if (pErr || !provider) return;

    const { data: requests } = await admin
      .from("service_requests")
      .select(
        "status, customer_id, response_time_seconds, created_at, accepted_at, rejected_at",
      )
      .eq("provider_id", providerId);

    const computed = computeProviderPerformance({
      providerId,
      verificationStatus: provider.verification_status,
      profileCompleteness: provider.profile_completeness,
      ratingAvg: Number(provider.rating_avg),
      reviewCount: provider.review_count,
      requests: requests ?? [],
    });

    await upsertProviderPerformance(computed);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[recomputeProviderPerformance]", error);
    }
  }
}

/**
 * Learn soft preferences from a customer's completed choices.
 */
export async function recomputeCustomerPreferences(
  customerId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: requests } = await admin
      .from("service_requests")
      .select("id, provider_id, status, created_at")
      .eq("customer_id", customerId)
      .in("status", ["completed", "reviewed", "accepted", "in_progress"]);

    if (!requests || requests.length === 0) return;

    const providerIds = [...new Set(requests.map((r) => r.provider_id))];
    const { data: providers } = await admin
      .from("providers")
      .select("id, rating_avg, response_time_hours")
      .in("id", providerIds);

    const planMap = await getActivePlanSlugsByProviderIds(providerIds);

    const providerById = new Map((providers ?? []).map((p) => [p.id, p]));
    let nearbyVotes = 0;
    let premiumVotes = 0;
    let ratingVotes = 0;
    let fastVotes = 0;
    let n = 0;

    for (const req of requests) {
      const p = providerById.get(req.provider_id);
      if (!p) continue;
      n += 1;
      // Without stored distance at booking time, treat high rating / speed / plan as proxies
      if (Number(p.rating_avg) >= 4.3) ratingVotes += 1;
      if (p.response_time_hours != null && p.response_time_hours <= 4) fastVotes += 1;
      const plan = planMap.get(req.provider_id);
      if (plan === "premium" || plan === "pro") premiumVotes += 1;
      nearbyVotes += 0.5; // neutral prior until distance-at-choice is logged in metadata
    }

    if (n === 0) return;

    const blend = (votes: number) =>
      Math.round((0.35 + (votes / n) * 0.65) * 10000) / 10000;

    const profile: CustomerPreferenceProfile = {
      customerId,
      preferNearby: blend(nearbyVotes),
      preferPremium: blend(premiumVotes),
      preferHighRating: blend(ratingVotes),
      preferFastResponse: blend(fastVotes),
      sampleSize: n,
    };

    await upsertCustomerPreferences(profile);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[recomputeCustomerPreferences]", error);
    }
  }
}

/** Schedule learning updates without awaiting in the request path. */
export function scheduleLearningUpdate(input: {
  providerId?: string | null;
  customerId?: string | null;
}): void {
  if (input.providerId) {
    void recomputeProviderPerformance(input.providerId);
  }
  if (input.customerId) {
    void recomputeCustomerPreferences(input.customerId);
  }
}
