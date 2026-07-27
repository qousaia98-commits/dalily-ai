/**
 * Provider capacity model — daily max, vacation, pause, business hours.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProviderCapacity } from "@/lib/matching-engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCapacity(row: any): ProviderCapacity {
  return {
    providerId: row.provider_id,
    maxDailyJobs: row.max_daily_jobs,
    jobsToday: row.jobs_today,
    vacationMode: Boolean(row.vacation_mode),
    pauseMode: Boolean(row.pause_mode),
    acceptingRequests: Boolean(row.accepting_requests),
    businessHours: (row.business_hours as Record<string, unknown>) ?? {},
    nextAvailableAt: row.next_available_at,
    workloadScore: Number(row.workload_score ?? 0.5),
  };
}

export async function getProviderCapacity(
  providerId: string,
): Promise<ProviderCapacity | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("provider_capacity")
      .select("*")
      .eq("provider_id", providerId)
      .maybeSingle();
    return data ? mapCapacity(data) : null;
  } catch {
    return null;
  }
}

export async function upsertProviderCapacity(input: {
  providerId: string;
  maxDailyJobs?: number;
  jobsToday?: number;
  vacationMode?: boolean;
  pauseMode?: boolean;
  acceptingRequests?: boolean;
  businessHours?: Record<string, unknown>;
}): Promise<ProviderCapacity | null> {
  try {
    const admin = createAdminClient();
    const max = input.maxDailyJobs ?? 8;
    const jobs = input.jobsToday ?? 0;
    const workload = max > 0 ? Math.min(1, jobs / max) : 0.5;
    const { data } = await admin
      .from("provider_capacity")
      .upsert(
        {
          provider_id: input.providerId,
          max_daily_jobs: max,
          jobs_today: jobs,
          vacation_mode: input.vacationMode ?? false,
          pause_mode: input.pauseMode ?? false,
          accepting_requests: input.acceptingRequests ?? true,
          business_hours: (input.businessHours ?? {}) as import("@/types/database.types").Json,
          workload_score: workload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "provider_id" },
      )
      .select("*")
      .single();
    return data ? mapCapacity(data) : null;
  } catch {
    return null;
  }
}

export function isProviderAvailableNow(cap: ProviderCapacity | null): boolean {
  if (!cap) return true;
  if (cap.vacationMode || cap.pauseMode) return false;
  if (!cap.acceptingRequests) return false;
  if (cap.jobsToday >= cap.maxDailyJobs) return false;
  return true;
}
