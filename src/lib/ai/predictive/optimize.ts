/**
 * Self-optimization — compare predictions with actuals and calibrate.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

/**
 * Compare recent demand forecasts vs actual request counts for yesterday.
 */
export async function calibrateDemandForecasts(): Promise<{
  compared: number;
  correct: number;
}> {
  let compared = 0;
  let correct = 0;

  try {
    const admin = createAdminClient();
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateKey = yesterday.toISOString().slice(0, 10);

    const { data: forecasts } = await admin
      .from("ai_demand_forecasts")
      .select("id, category_slug, predicted_requests, forecast_date")
      .eq("forecast_date", dateKey)
      .is("compared_at", null)
      .limit(50);

    if (!forecasts?.length) return { compared: 0, correct: 0 };

    const dayStart = `${dateKey}T00:00:00.000Z`;
    const dayEnd = `${dateKey}T23:59:59.999Z`;

    const { data: cats } = await admin.from("categories").select("id, slug").limit(500);
    const slugToId = new Map(
      (cats ?? []).map((c) => [c.slug as string, c.id as string]),
    );

    const { data: actuals } = await admin
      .from("service_requests")
      .select("category_id")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .limit(5000);

    const actualBySlug = new Map<string, number>();
    const idToSlug = new Map(
      (cats ?? []).map((c) => [c.id as string, c.slug as string]),
    );
    for (const r of actuals ?? []) {
      const slug = idToSlug.get(r.category_id as string) ?? "unknown";
      actualBySlug.set(slug, (actualBySlug.get(slug) ?? 0) + 1);
    }

    for (const f of forecasts) {
      const slug = f.category_slug as string;
      const actual = actualBySlug.get(slug) ?? 0;
      const predicted = Number(f.predicted_requests);
      const error = Math.abs(predicted - actual);
      const relative = predicted > 0 ? error / predicted : actual > 0 ? 1 : 0;
      const wasCorrect = relative <= 0.4;

      await admin
        .from("ai_demand_forecasts")
        .update({
          actual_requests: actual,
          compared_at: new Date().toISOString(),
        } as never)
        .eq("id", f.id);

      await admin.from("ai_prediction_outcomes").insert({
        prediction_type: "demand",
        reference_id: f.id,
        predicted: { requests: predicted, categorySlug: slug } as unknown as Json,
        actual: { requests: actual } as unknown as Json,
        error_metric: Math.round(relative * 1000) / 1000,
        was_correct: wasCorrect,
        compared_at: new Date().toISOString(),
      } as never);

      compared += 1;
      if (wasCorrect) correct += 1;

      void emitAiLearningEvent({
        eventType: wasCorrect ? "forecast_correct" : "forecast_incorrect",
        metadata: {
          type: "demand",
          categorySlug: slug,
          predicted,
          actual,
          relativeError: relative,
        },
      });
    }

    void emitAiLearningEvent({
      eventType: "prediction_calibrated",
      metadata: { compared, correct, dateKey },
    });

    // silence unused
    void slugToId;
  } catch {
    // non-blocking
  }

  return { compared, correct };
}
