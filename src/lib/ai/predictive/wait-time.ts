/**
 * Smart wait-time estimates before / during request creation.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { WaitTimeEstimate } from "./types";

const DEFAULTS: Record<string, { resp: [number, number]; arr: [number, number] }> = {
  electrical: { resp: [10, 25], arr: [30, 75] },
  plumbing: { resp: [15, 35], arr: [40, 90] },
  hvac: { resp: [20, 45], arr: [60, 180] },
  locksmith: { resp: [5, 15], arr: [20, 45] },
  painting: { resp: [60, 240], arr: [1440, 4320] },
  default: { resp: [15, 40], arr: [45, 120] },
};

export async function estimateWaitTime(input: {
  categorySlug: string;
  cityId?: string | null;
}): Promise<WaitTimeEstimate> {
  const slug = input.categorySlug.toLowerCase() || "default";
  const base =
    DEFAULTS[slug] ??
    Object.entries(DEFAULTS).find(([k]) => slug.includes(k))?.[1] ??
    DEFAULTS.default!;

  let sampleSize = 0;
  let avgResponseMin: number | null = null;

  try {
    const admin = createAdminClient();
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);

    // response_time_seconds on completed/accepted requests if present
    let query = admin
      .from("service_requests")
      .select("response_time_seconds, category_id, city_id")
      .gte("created_at", since.toISOString())
      .not("response_time_seconds", "is", null)
      .limit(500);

    if (input.cityId) query = query.eq("city_id", input.cityId);

    const [{ data }, { data: cats }] = await Promise.all([
      query,
      admin.from("categories").select("id, slug").limit(500),
    ]);
    const catMap = new Map(
      (cats ?? []).map((c) => [c.id as string, (c.slug as string) || ""]),
    );
    const matched = (data ?? []).filter((r) => {
      const s = (catMap.get(r.category_id as string) ?? "").toLowerCase();
      return s === slug || s.includes(slug) || slug.includes(s);
    });
    sampleSize = matched.length;
    if (matched.length >= 3) {
      const mins = matched.map((r) => Number(r.response_time_seconds) / 60);
      avgResponseMin = mins.reduce((a, b) => a + b, 0) / mins.length;
    }
  } catch {
    // use defaults
  }

  let responseMin = base.resp[0];
  let responseMax = base.resp[1];
  let arrivalMin = base.arr[0];
  let arrivalMax = base.arr[1];

  if (avgResponseMin != null) {
    responseMin = Math.max(5, Math.round(avgResponseMin * 0.7));
    responseMax = Math.max(responseMin + 5, Math.round(avgResponseMin * 1.4));
    arrivalMin = Math.round(responseMax * 1.5);
    arrivalMax = Math.round(responseMax * 3);
  }

  const confidence = sampleSize >= 10 ? 0.75 : sampleSize >= 3 ? 0.55 : 0.4;

  const estimate: WaitTimeEstimate = {
    categorySlug: slug,
    cityId: input.cityId ?? null,
    responseMinMinutes: responseMin,
    responseMaxMinutes: responseMax,
    arrivalMinMinutes: arrivalMin,
    arrivalMaxMinutes: arrivalMax,
    confidence,
    sampleSize,
    labelEn: `Response ${responseMin}–${responseMax} min · Arrival ${formatArrival(arrivalMin, arrivalMax)}`,
    labelAr: `الرد ${responseMin}–${responseMax} د · الوصول ${formatArrival(arrivalMin, arrivalMax)}`,
  };

  try {
    const admin = createAdminClient();
    await admin.from("ai_wait_time_estimates").upsert(
      {
        category_slug: estimate.categorySlug,
        city_id: estimate.cityId,
        response_min_minutes: estimate.responseMinMinutes,
        response_max_minutes: estimate.responseMaxMinutes,
        arrival_min_minutes: estimate.arrivalMinMinutes,
        arrival_max_minutes: estimate.arrivalMaxMinutes,
        confidence: estimate.confidence,
        sample_size: estimate.sampleSize,
      } as never,
      { onConflict: "category_slug,city_id" },
    );
  } catch {
    // best-effort
  }

  void emitAiLearningEvent({
    eventType: "wait_time_prediction",
    metadata: {
      categorySlug: slug,
      responseMin,
      responseMax,
      sampleSize,
    },
  });

  return estimate;
}

function formatArrival(min: number, max: number): string {
  if (max >= 1440) {
    const dMin = Math.round(min / 1440);
    const dMax = Math.round(max / 1440);
    return `${dMin}–${dMax} days`;
  }
  return `${min}–${max} min`;
}
