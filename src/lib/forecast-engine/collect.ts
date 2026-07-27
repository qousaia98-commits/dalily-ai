/**
 * Collect forecast raw signals from market snapshots + live activity.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ForecastHorizon,
  ForecastRawSignals,
} from "@/lib/forecast-engine/types";

export type ForecastCollectInput = {
  categoryKey: string;
  regionKey?: string | null;
  horizon: ForecastHorizon;
  mlDemandFactor?: number | null;
};

const SNAPSHOT_CACHE = new Map<
  string,
  {
    at: number;
    demandIndex: number;
    bookingVelocity: number;
    cancellationRate: number;
    complaintRate: number;
    availability: number;
    pricingTrend: number;
  }
>();
const SNAPSHOT_TTL_MS = 5 * 60_000;

export async function collectForecastRaw(
  input: ForecastCollectInput,
): Promise<ForecastRawSignals> {
  const categoryKey = input.categoryKey || "general";
  const regionKey = input.regionKey || "all";
  const cacheKey = `${categoryKey}:${regionKey}`;

  let demandIndex = 0.5;
  let bookingVelocity = 2;
  let cancellationRate = 0.08;
  let complaintRate = 0.04;
  let availability = 0.55;
  let pricingTrend = 0.5;

  const cached = SNAPSHOT_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < SNAPSHOT_TTL_MS) {
    demandIndex = cached.demandIndex;
    bookingVelocity = cached.bookingVelocity;
    cancellationRate = cached.cancellationRate;
    complaintRate = cached.complaintRate;
    availability = cached.availability;
    pricingTrend = cached.pricingTrend;
  } else {
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("forecast_market_snapshots")
        .select("*")
        .eq("category_key", categoryKey)
        .eq("region_key", regionKey)
        .maybeSingle();

      if (data) {
        demandIndex = Number(data.demand_index ?? 0.5);
        bookingVelocity = Number(data.booking_velocity ?? 2);
        cancellationRate = Number(data.cancellation_rate ?? 0.08);
        complaintRate = Number(data.complaint_rate ?? 0.04);
        availability = Number(data.provider_availability_index ?? 0.55);
        pricingTrend = Number(data.pricing_trend_index ?? 0.5);
      } else {
        // Soft seed from recent service_requests
        const since = new Date();
        since.setUTCDate(since.getUTCDate() - 14);
        const { data: rows } = await admin
          .from("service_requests")
          .select("id, created_at")
          .gte("created_at", since.toISOString())
          .limit(500);
        const count = rows?.length ?? 0;
        bookingVelocity = Math.max(0.5, count / 14);
        demandIndex = Math.min(1, count / 80);
      }

      SNAPSHOT_CACHE.set(cacheKey, {
        at: Date.now(),
        demandIndex,
        bookingVelocity,
        cancellationRate,
        complaintRate,
        availability,
        pricingTrend,
      });
    } catch {
      /* defaults */
    }
  }

  const now = new Date();
  const dow = now.getUTCDay();
  const hour = now.getUTCHours();
  const month = now.getUTCMonth();

  const seasonality01 =
    month >= 5 && month <= 8 ? 0.7 : month <= 1 || month === 11 ? 0.55 : 0.4;
  const weekdayBoost = dow === 0 || dow === 6 ? 0.95 : dow === 4 || dow === 5 ? 1.12 : 1.02;
  const timeOfDayBoost =
    hour >= 8 && hour <= 11 ? 1.1 : hour >= 16 && hour <= 20 ? 1.15 : 0.95;

  // Simple calendar heuristics (future: real calendars)
  const holiday = false;
  const schoolHoliday = month === 6 || month === 7;
  const businessEvent = false;

  const historicalIndex = Math.min(1, bookingVelocity / 8);
  const baselineDemand = Math.max(0.5, bookingVelocity);

  return {
    categoryKey,
    regionKey,
    horizon: input.horizon,
    historicalIndex,
    categoryDemandIndex: demandIndex,
    regionalDemandIndex: regionKey !== "all" ? Math.min(1, demandIndex * 1.05) : demandIndex,
    seasonality01,
    weekdayBoost,
    timeOfDayBoost,
    holiday,
    schoolHoliday,
    businessEvent,
    weather01: 0,
    providerAvailability01: availability,
    pricingTrend01: pricingTrend,
    cancellationRate01: cancellationRate,
    complaintRate01: complaintRate,
    economic01: 0.5,
    baselineDemand,
    mlDemandFactor: input.mlDemandFactor ?? null,
  };
}

export function invalidateForecastSnapshotCache(): void {
  SNAPSHOT_CACHE.clear();
}
