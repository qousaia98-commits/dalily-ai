import { createAdminClient } from "@/lib/supabase/admin";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

/**
 * Continuous learning: compare predictions vs actuals after assignment outcomes.
 */
export async function compareDispatchPrediction(input: {
  serviceRequestId: string;
  providerId: string;
  actualRespondedAt?: string | null;
  actualAccepted?: boolean | null;
  actualArrivedAt?: string | null;
  actualDurationMinutes?: number | null;
  actualCustomerChose?: boolean | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("ai_dispatch_predictions")
      .select(
        "id, response_probability, eta_minutes_min, eta_minutes_max, predicted_duration_minutes, predicted_rank, created_at",
      )
      .eq("service_request_id", input.serviceRequestId)
      .eq("provider_id", input.providerId)
      .is("compared_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) return;

    const created = new Date(row.created_at as string).getTime();
    let responseErrorMinutes: number | null = null;
    if (input.actualRespondedAt) {
      responseErrorMinutes = Math.round(
        (new Date(input.actualRespondedAt).getTime() - created) / 60000,
      );
    }

    let etaErrorMinutes: number | null = null;
    if (
      input.actualArrivedAt &&
      row.eta_minutes_min != null &&
      row.eta_minutes_max != null
    ) {
      const actualEta = Math.round(
        (new Date(input.actualArrivedAt).getTime() - created) / 60000,
      );
      const mid =
        (Number(row.eta_minutes_min) + Number(row.eta_minutes_max)) / 2;
      etaErrorMinutes = Math.round(actualEta - mid);
    }

    let durationError: number | null = null;
    if (
      input.actualDurationMinutes != null &&
      row.predicted_duration_minutes != null
    ) {
      durationError =
        input.actualDurationMinutes - Number(row.predicted_duration_minutes);
    }

    await admin
      .from("ai_dispatch_predictions")
      .update({
        actual_responded_at: input.actualRespondedAt ?? null,
        actual_accepted: input.actualAccepted ?? null,
        actual_arrived_at: input.actualArrivedAt ?? null,
        actual_duration_minutes: input.actualDurationMinutes ?? null,
        actual_customer_chose: input.actualCustomerChose ?? null,
        compared_at: new Date().toISOString(),
        metadata: {
          responseErrorMinutes,
          etaErrorMinutes,
          durationError,
        },
      } as never)
      .eq("id", row.id);

    void emitAiLearningEvent({
      eventType: "prediction_compared",
      providerId: input.providerId,
      serviceRequestId: input.serviceRequestId,
      metadata: {
        responseErrorMinutes,
        etaErrorMinutes,
        durationError,
        actualAccepted: input.actualAccepted ?? null,
        actualCustomerChose: input.actualCustomerChose ?? null,
        predictedRank: row.predicted_rank,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[dispatch.compare]", error);
    }
  }
}
