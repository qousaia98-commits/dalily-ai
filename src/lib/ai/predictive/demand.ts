/**
 * Demand prediction from historical requests + calendar priors.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  dayOfWeek,
  fridayEveningBoost,
  getSeason,
  isHoliday,
  seasonalCategoryMultiplier,
  toDateKey,
  weatherMultiplier,
} from "./calendar";
import type { DemandForecastPoint, DemandForecastResult, DemandDriver } from "./types";

type HistBucket = {
  categorySlug: string;
  cityId: string | null;
  dow: number;
  hour: number;
  count: number;
  emergencies: number;
};

async function loadHistoricalBuckets(daysBack = 56): Promise<HistBucket[]> {
  try {
    const admin = createAdminClient();
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - daysBack);

    const [{ data: rows }, { data: cats }] = await Promise.all([
      admin
        .from("service_requests")
        .select("created_at, urgency, city_id, category_id")
        .gte("created_at", since.toISOString())
        .limit(8000),
      admin.from("categories").select("id, slug").limit(500),
    ]);

    const catMap = new Map(
      (cats ?? []).map((c) => [c.id as string, (c.slug as string) || "unknown"]),
    );
    const map = new Map<string, HistBucket>();

    for (const row of rows ?? []) {
      const created = new Date(row.created_at as string);
      const cat = catMap.get(row.category_id as string) ?? "unknown";
      const cityId = (row.city_id as string | null) ?? null;
      const dow = dayOfWeek(created);
      const hour = created.getUTCHours();
      const key = `${cat}|${cityId ?? "_"}|${dow}|${hour}`;
      const cur = map.get(key) ?? {
        categorySlug: cat,
        cityId,
        dow,
        hour,
        count: 0,
        emergencies: 0,
      };
      cur.count += 1;
      if (row.urgency === "emergency") cur.emergencies += 1;
      map.set(key, cur);
    }

    return Array.from(map.values());
  } catch {
    return [];
  }
}

function avgFor(
  buckets: HistBucket[],
  categorySlug: string,
  dow: number,
  hour: number,
): { avg: number; emergencyRate: number; n: number } {
  const matched = buckets.filter(
    (b) => b.categorySlug === categorySlug && b.dow === dow && Math.abs(b.hour - hour) <= 1,
  );
  if (matched.length === 0) {
    const broad = buckets.filter((b) => b.categorySlug === categorySlug && b.dow === dow);
    if (broad.length === 0) return { avg: 0.3, emergencyRate: 0.05, n: 0 };
    const sum = broad.reduce((s, b) => s + b.count, 0);
    const em = broad.reduce((s, b) => s + b.emergencies, 0);
    return { avg: sum / Math.max(1, broad.length), emergencyRate: em / Math.max(1, sum), n: broad.length };
  }
  const sum = matched.reduce((s, b) => s + b.count, 0);
  const em = matched.reduce((s, b) => s + b.emergencies, 0);
  return {
    avg: sum / matched.length,
    emergencyRate: em / Math.max(1, sum),
    n: matched.length,
  };
}

/**
 * Forecast demand for the next `horizonDays` (hourly samples at peak hours).
 */
export async function forecastDemand(input?: {
  horizonDays?: number;
  categories?: string[];
  weatherStress?: number | null;
}): Promise<DemandForecastResult> {
  const horizonDays = input?.horizonDays ?? 7;
  const buckets = await loadHistoricalBuckets();
  const categories =
    input?.categories?.length
      ? input.categories
      : Array.from(new Set(buckets.map((b) => b.categorySlug))).slice(0, 12);

  const fallbackCats =
    categories.length > 0
      ? categories
      : ["electrical", "plumbing", "hvac", "painting", "locksmith"];

  const points: DemandForecastPoint[] = [];
  const now = new Date();

  for (let d = 0; d < horizonDays; d++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() + d);
    const dateKey = toDateKey(date);
    const season = getSeason(date);
    const dow = dayOfWeek(date);
    const holiday = isHoliday(date);
    const hours = [9, 12, 17, 20];

    for (const categorySlug of fallbackCats) {
      for (const hour of hours) {
        const hist = avgFor(buckets, categorySlug, dow, hour);
        let predicted = hist.avg;
        const drivers: DemandForecastPoint["drivers"] = [];

        const seasonMul = seasonalCategoryMultiplier(categorySlug, season);
        if (seasonMul !== 1) {
          predicted *= seasonMul;
          drivers.push({
            code: "season" as DemandDriver,
            weight: seasonMul - 1,
            noteEn: `${season} lift for ${categorySlug}`,
          });
        }

        const fridayMul = fridayEveningBoost(categorySlug, dow, hour);
        if (fridayMul !== 1) {
          predicted *= fridayMul;
          drivers.push({
            code: "day_of_week",
            weight: fridayMul - 1,
            noteEn: "Friday evening demand spike",
          });
        }

        if (holiday) {
          predicted *= 0.85;
          drivers.push({
            code: "holiday",
            weight: -0.15,
            noteEn: "Holiday dampens routine demand",
          });
        }

        if (hist.emergencyRate > 0.15) {
          predicted *= 1 + hist.emergencyRate * 0.3;
          drivers.push({
            code: "emergency_rate",
            weight: hist.emergencyRate,
            noteEn: "Elevated emergency share historically",
          });
        }

        const wMul = weatherMultiplier(input?.weatherStress);
        if (wMul !== 1) {
          predicted *= wMul;
          drivers.push({
            code: "weather_ready",
            weight: wMul - 1,
            noteEn: "Weather stress multiplier (architecture ready)",
          });
        }

        drivers.push({
          code: "historical",
          weight: Math.min(1, hist.n / 20),
          noteEn: `Based on ${hist.n} similar historical buckets`,
        });

        const confidence = Math.min(0.9, 0.35 + hist.n * 0.03);

        points.push({
          date: dateKey,
          hourBucket: hour,
          cityId: null,
          categorySlug,
          predictedRequests: Math.round(predicted * 100) / 100,
          confidence,
          drivers,
        });
      }
    }
  }

  // Persist top daily aggregates
  try {
    const admin = createAdminClient();
    const byDayCat = new Map<string, number>();
    for (const p of points) {
      const k = `${p.date}|${p.categorySlug}`;
      byDayCat.set(k, (byDayCat.get(k) ?? 0) + p.predictedRequests);
    }
    const rows = Array.from(byDayCat.entries())
      .slice(0, 80)
      .map(([k, predicted]) => {
        const [forecast_date, category_slug] = k.split("|");
        return {
          forecast_date,
          hour_bucket: null,
          city_id: null,
          category_slug,
          predicted_requests: Math.round(predicted * 100) / 100,
          confidence: 0.55,
          drivers: [] as unknown as Json,
          model_version: "v8-heuristic",
        };
      });
    if (rows.length) {
      await admin.from("ai_demand_forecasts").insert(rows as never);
    }
  } catch {
    // best-effort
  }

  void emitAiLearningEvent({
    eventType: "demand_prediction",
    metadata: { pointCount: points.length, horizonDays },
  });

  const top = [...points]
    .sort((a, b) => b.predictedRequests - a.predictedRequests)
    .slice(0, 3);

  const highlightsEn = top.map(
    (p) =>
      `${p.date} ~${p.hourBucket}:00 — ${p.categorySlug}: ~${p.predictedRequests.toFixed(1)} requests`,
  );
  const highlightsAr = top.map(
    (p) =>
      `${p.date} حوالي ${p.hourBucket}:00 — ${p.categorySlug}: ~${p.predictedRequests.toFixed(1)} طلب`,
  );

  return {
    version: 8,
    generatedAt: new Date().toISOString(),
    horizonDays,
    points,
    highlightsEn,
    highlightsAr,
  };
}
