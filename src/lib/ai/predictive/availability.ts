/**
 * Provider availability forecasting.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import type { BookingStatus, Database, Json } from "@/types/database.types";
import { toDateKey } from "./calendar";
import type { AvailabilityForecast } from "./types";

type AvailabilityForecastInsert =
  Database["public"]["Tables"]["ai_availability_forecasts"]["Insert"];

const INACTIVE_BOOKING_STATUSES: ReadonlySet<BookingStatus> = new Set([
  "cancelled",
  "declined",
  "expired",
]);

export async function forecastProviderAvailability(input: {
  providerId: string;
  horizonDays?: number;
}): Promise<AvailabilityForecast[]> {
  const horizon = input.horizonDays ?? 7;
  const forecasts: AvailabilityForecast[] = [];

  try {
    const admin = createAdminClient();
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 28);

    const [{ data: bookings }, { data: hours }] = await Promise.all([
      admin
        .from("bookings")
        .select("starts_at, ends_at, status")
        .eq("provider_id", input.providerId)
        .gte("starts_at", since.toISOString())
        .is("deleted_at", null)
        .limit(500),
      admin
        .from("provider_working_hours")
        .select("day_of_week, opens_at, closes_at, is_closed")
        .eq("provider_id", input.providerId),
    ]);

    // Acceptance proxy from recent marketplace offers if available
    let acceptanceProbability = 0.55;
    try {
      const { data: offers } = await admin
        .from("marketplace_offers")
        .select("status, created_at")
        .eq("provider_id", input.providerId)
        .gte("created_at", since.toISOString())
        .limit(100);
      const total = offers?.length ?? 0;
      const selected = (offers ?? []).filter((o) => o.status === "selected").length;
      if (total > 0) acceptanceProbability = Math.min(0.95, 0.35 + selected / total);
    } catch {
      // optional
    }

    const workingByDow = new Map<number, number>();
    for (const h of hours ?? []) {
      if (h.is_closed) continue;
      const dow = Number(h.day_of_week);
      const start = String(h.opens_at ?? "09:00").slice(0, 5);
      const end = String(h.closes_at ?? "17:00").slice(0, 5);
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const free = Math.max(0, eh + em / 60 - (sh + sm / 60));
      workingByDow.set(dow, (workingByDow.get(dow) ?? 0) + free);
    }

    const bookingsByDate = new Map<string, number>();
    for (const b of bookings ?? []) {
      if (INACTIVE_BOOKING_STATUSES.has(b.status)) continue;
      const key = toDateKey(new Date(b.starts_at));
      bookingsByDate.set(key, (bookingsByDate.get(key) ?? 0) + 1);
    }

    // Typical daily bookings by dow
    const histByDow = new Map<number, number[]>();
    for (const [dateKey, count] of bookingsByDate) {
      const dow = new Date(dateKey + "T12:00:00Z").getUTCDay();
      const arr = histByDow.get(dow) ?? [];
      arr.push(count);
      histByDow.set(dow, arr);
    }

    const now = new Date();
    for (let d = 0; d < horizon; d++) {
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() + d);
      const dateKey = toDateKey(date);
      const dow = date.getUTCDay();
      const workHours = workingByDow.get(dow) ?? 8;
      const hist = histByDow.get(dow) ?? [];
      const avgBookings =
        hist.length > 0 ? hist.reduce((a, b) => a + b, 0) / hist.length : 1;

      const predictedBookings = Math.round(avgBookings);
      const hoursPerBooking = 1.5;
      const used = predictedBookings * hoursPerBooking;
      const predictedFreeHours = Math.max(0, Math.round((workHours - used) * 10) / 10);

      let expectedWorkload: AvailabilityForecast["expectedWorkload"] = "light";
      const util = workHours > 0 ? used / workHours : 0;
      if (util >= 1.1) expectedWorkload = "overloaded";
      else if (util >= 0.75) expectedWorkload = "heavy";
      else if (util >= 0.4) expectedWorkload = "moderate";

      const drivers = [
        `working_hours≈${workHours}h`,
        `typical_bookings≈${avgBookings.toFixed(1)}`,
        `acceptance≈${Math.round(acceptanceProbability * 100)}%`,
      ];

      forecasts.push({
        providerId: input.providerId,
        date: dateKey,
        predictedFreeHours,
        predictedBookings,
        acceptanceProbability,
        expectedWorkload,
        confidence: hist.length > 0 ? Math.min(0.85, 0.4 + hist.length * 0.05) : 0.35,
        drivers,
      });
    }

    // Persist
    try {
      const rows: AvailabilityForecastInsert[] = forecasts.map((f) => ({
        provider_id: f.providerId,
        forecast_date: f.date,
        predicted_free_hours: f.predictedFreeHours,
        predicted_bookings: f.predictedBookings,
        acceptance_probability: f.acceptanceProbability,
        expected_workload: f.expectedWorkload,
        confidence: f.confidence,
        drivers: f.drivers satisfies Json,
      }));
      await admin.from("ai_availability_forecasts").upsert(rows, {
        onConflict: "provider_id,forecast_date",
      });
    } catch {
      // best-effort
    }

    void emitAiLearningEvent({
      eventType: "capacity_prediction",
      providerId: input.providerId,
      metadata: { days: forecasts.length },
    });
  } catch {
    // return empty
  }

  return forecasts;
}
