import { createAdminClient } from "@/lib/supabase/admin";
import type { LearningEventType } from "./types";
import type { CustomerPreferenceProfile, ProviderPerformanceRow } from "./types";

export type LogLearningEventInput = {
  eventType: LearningEventType;
  providerId?: string | null;
  customerId?: string | null;
  serviceRequestId?: string | null;
  searchLogId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append-only learning event. Never throws — learning must not break UX.
 */
export async function logLearningEvent(input: LogLearningEventInput): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("learning_events").insert({
      event_type: input.eventType,
      provider_id: input.providerId ?? null,
      customer_id: input.customerId ?? null,
      service_request_id: input.serviceRequestId ?? null,
      search_log_id: input.searchLogId ?? null,
      metadata: (input.metadata ?? {}) as import("@/types/database.types").Json,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[learning_events]", error);
    }
  }
}

export async function fetchPerformanceScoresByProviderIds(
  providerIds: string[],
): Promise<Map<string, ProviderPerformanceRow>> {
  const map = new Map<string, ProviderPerformanceRow>();
  if (providerIds.length === 0) return map;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("provider_performance_scores")
      .select("*")
      .in("provider_id", providerIds);

    if (error || !data) return map;

    for (const row of data) {
      map.set(row.provider_id, {
        providerId: row.provider_id,
        performanceScore: Number(row.performance_score),
        acceptanceRate:
          row.acceptance_rate == null ? null : Number(row.acceptance_rate),
        completionRate:
          row.completion_rate == null ? null : Number(row.completion_rate),
        avgRating: row.avg_rating == null ? null : Number(row.avg_rating),
        avgResponseHours:
          row.avg_response_hours == null ? null : Number(row.avg_response_hours),
        cancellationRate:
          row.cancellation_rate == null ? null : Number(row.cancellation_rate),
        repeatCustomerRate:
          row.repeat_customer_rate == null
            ? null
            : Number(row.repeat_customer_rate),
        successfulJobs: row.successful_jobs,
        sampleSize: row.sample_size,
        dataQuality: Number(row.data_quality),
        factors: (row.factors ?? {}) as Record<string, number>,
        computedAt: row.computed_at,
      });
    }
  } catch {
    // Table may not exist until migration — ranking continues without learning.
  }

  return map;
}

export async function fetchCustomerPreferenceProfile(
  customerId: string | null | undefined,
): Promise<CustomerPreferenceProfile | null> {
  if (!customerId) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("customer_preference_profiles")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      customerId: data.customer_id,
      preferNearby: Number(data.prefer_nearby),
      preferPremium: Number(data.prefer_premium),
      preferHighRating: Number(data.prefer_high_rating),
      preferFastResponse: Number(data.prefer_fast_response),
      sampleSize: data.sample_size,
    };
  } catch {
    return null;
  }
}

export async function upsertProviderPerformance(
  row: Omit<ProviderPerformanceRow, "computedAt">,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    await admin.from("provider_performance_scores").upsert(
      {
        provider_id: row.providerId,
        performance_score: row.performanceScore,
        acceptance_rate: row.acceptanceRate,
        completion_rate: row.completionRate,
        avg_rating: row.avgRating,
        avg_response_hours: row.avgResponseHours,
        cancellation_rate: row.cancellationRate,
        repeat_customer_rate: row.repeatCustomerRate,
        successful_jobs: row.successfulJobs,
        sample_size: row.sampleSize,
        data_quality: row.dataQuality,
        factors: row.factors as import("@/types/database.types").Json,
        computed_at: now,
        updated_at: now,
      },
      { onConflict: "provider_id" },
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[provider_performance_scores]", error);
    }
  }
}

export async function upsertCustomerPreferences(
  profile: CustomerPreferenceProfile,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    await admin.from("customer_preference_profiles").upsert(
      {
        customer_id: profile.customerId,
        prefer_nearby: profile.preferNearby,
        prefer_premium: profile.preferPremium,
        prefer_high_rating: profile.preferHighRating,
        prefer_fast_response: profile.preferFastResponse,
        sample_size: profile.sampleSize,
        computed_at: now,
        updated_at: now,
      },
      { onConflict: "customer_id" },
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[customer_preference_profiles]", error);
    }
  }
}
