/**
 * Load provider visibility tips for the business dashboard.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildProviderVisibilityTips,
  type ProviderVisibilityTip,
} from "@/domains/offer/recommendation";
import { isOfferDecisionEngineEnabled } from "@/lib/config/feature-flags";
import { fetchCompletedJobsByProviderIds } from "@/domains/matching";

export async function loadProviderVisibilityTips(
  providerId: string,
): Promise<ProviderVisibilityTip[]> {
  if (!isOfferDecisionEngineEnabled()) return [];

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: provider }, { data: perf }, { count: galleryCount }, { data: settings }, jobsMap] =
    await Promise.all([
      supabase
        .from("providers")
        .select(
          "verification_status, profile_completeness, rating_avg, review_count",
        )
        .eq("id", providerId)
        .maybeSingle(),
      admin
        .from("provider_performance_scores")
        .select("avg_response_hours, cancellation_rate, successful_jobs")
        .eq("provider_id", providerId)
        .maybeSingle(),
      supabase
        .from("images")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .eq("kind", "gallery")
        .is("deleted_at", null),
      supabase
        .from("provider_request_settings")
        .select("accepting_requests, vacation_mode")
        .eq("provider_id", providerId)
        .maybeSingle(),
      fetchCompletedJobsByProviderIds([providerId]),
    ]);

  if (!provider) return [];

  const completedJobs =
    jobsMap.get(providerId) ??
    (perf?.successful_jobs != null ? Number(perf.successful_jobs) : 0);

  return buildProviderVisibilityTips({
    profileCompleteness: Number(provider.profile_completeness ?? 0),
    verified: provider.verification_status === "verified",
    reviewCount: Number(provider.review_count ?? 0),
    ratingAvg: Number(provider.rating_avg ?? 0),
    responseHoursAvg:
      perf?.avg_response_hours != null ? Number(perf.avg_response_hours) : null,
    cancellationRate:
      perf?.cancellation_rate != null ? Number(perf.cancellation_rate) : null,
    portfolioSize: galleryCount ?? 0,
    availableNow:
      settings == null
        ? true
        : Boolean(settings.accepting_requests) && !Boolean(settings.vacation_mode),
    completedJobs,
  });
}
