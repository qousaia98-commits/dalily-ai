import { getTranslations } from "next-intl/server";
import type { MatchReason, MatchReasonCode } from "@/domains/matching";
import { MATCH_REASON_CODES } from "@/domains/matching";

type AiBullet = {
  code: string;
  params?: Record<string, string | number>;
  labelEn?: string;
};

/**
 * Presentational why-matched chips — copy only; reasons come from Matching / AI.
 */
export async function WhyMatchedReasons({
  reasons,
  aiMatchScore,
  aiExplanation,
}: {
  reasons: MatchReason[];
  aiMatchScore?: number | null;
  aiExplanation?: AiBullet[] | null;
}) {
  const t = await getTranslations("providerDashboard.matchReasons");
  const known = new Set<string>(MATCH_REASON_CODES);
  const bullets: AiBullet[] =
    aiExplanation && aiExplanation.length > 0
      ? aiExplanation
      : reasons.map((r) => ({
          code: r.code,
          params: r.params,
        }));

  if (!bullets.length && aiMatchScore == null) return null;

  return (
    <div className="mt-2 space-y-1.5">
      {aiMatchScore != null ? (
        <p className="text-[0.7rem] font-semibold text-muted-foreground">
          {t("match_score", { score: Math.round(aiMatchScore) })}
        </p>
      ) : null}
      <ul className="flex flex-wrap gap-1.5" aria-label={t("label")}>
        {bullets.map((r) => {
          const code = r.code;
          const label =
            known.has(code) ||
            [
              "nearby",
              "available",
              "excellent_rating",
              "similar_jobs",
              "fast_response",
              "high_acceptance",
              "match_score",
              "nearby_available",
              "route_fit",
              "service_distance",
              "service_fit",
              "operational_score",
              "response_band",
              "emergency_exposure",
            ].includes(code)
              ? t(
                  code as MatchReasonCode,
                  (r.params ?? {}) as Record<string, string | number>,
                )
              : (r.labelEn ?? code);
          return (
            <li
              key={`${r.code}-${JSON.stringify(r.params ?? {})}`}
              className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[0.7rem] font-medium text-muted-foreground"
            >
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
