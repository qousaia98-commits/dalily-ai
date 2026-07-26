import type {
  DispatchExplanation,
  DispatchExplanationAudience,
  DispatchScoreResult,
  ExposureMode,
} from "@/lib/ai/dispatch/types";

/**
 * Audience-specific explainability for dispatch decisions.
 */
export function buildDispatchExplanations(input: {
  result: Omit<DispatchScoreResult, "explanations">;
  exposureMode: ExposureMode;
}): DispatchExplanation[] {
  const r = input.result;
  const out: DispatchExplanation[] = [];

  // Customer-facing
  out.push(
    explain(
      "customer",
      "nearby_available",
      r.distanceKm != null
        ? `Recommended because this provider is nearby (${r.distanceKm.toFixed(1)} km) and available today.`
        : "Recommended because this provider is available and a strong fit for your request.",
      r.distanceKm != null ? { km: Number(r.distanceKm.toFixed(1)) } : undefined,
    ),
  );

  // Provider-facing
  if (r.routeFit.fits && r.distanceKm != null) {
    out.push(
      explain(
        "provider",
        "route_fit",
        `This request matches your services, is only ${r.distanceKm.toFixed(1)} km away and fits between existing appointments.`,
        { km: Number(r.distanceKm.toFixed(1)) },
      ),
    );
  } else if (r.distanceKm != null) {
    out.push(
      explain(
        "provider",
        "service_distance",
        `This request matches your services and is only ${r.distanceKm.toFixed(1)} km away.`,
        { km: Number(r.distanceKm.toFixed(1)) },
      ),
    );
  } else {
    out.push(
      explain(
        "provider",
        "service_fit",
        "This request matches your services and current capacity.",
      ),
    );
  }

  // Admin-facing
  out.push(
    explain(
      "admin",
      "operational_score",
      `This provider was selected because of the highest operational score (${r.operationalScore}%).`,
      { score: r.operationalScore },
    ),
  );

  if (r.responseBand === "very_high" || r.responseBand === "high") {
    out.push(
      explain(
        "admin",
        "response_band",
        `Response probability band: ${r.responseBand.replace("_", " ")} (${Math.round(r.responseProbability * 100)}%).`,
        { band: r.responseBand, pct: Math.round(r.responseProbability * 100) },
      ),
    );
  }

  if (input.exposureMode === "emergency_broadcast") {
    out.push(
      explain(
        "admin",
        "emergency_exposure",
        "Exposure mode: emergency broadcast — prioritized available providers.",
      ),
    );
  }

  return out;
}

function explain(
  audience: DispatchExplanationAudience,
  code: string,
  labelEn: string,
  params?: Record<string, string | number>,
): DispatchExplanation {
  return { audience, code, params, labelEn };
}

/** Flatten to Phase-2 style bullets for match_assignments.ai_explanation. */
export function toAssignmentExplanationBullets(
  items: DispatchExplanation[],
  audience: DispatchExplanationAudience = "provider",
): Array<{ code: string; params?: Record<string, string | number>; labelEn: string }> {
  return items
    .filter((i) => i.audience === audience || i.audience === "admin")
    .slice(0, 5)
    .map((i) => ({
      code: i.code,
      params: i.params,
      labelEn: i.labelEn,
    }));
}
