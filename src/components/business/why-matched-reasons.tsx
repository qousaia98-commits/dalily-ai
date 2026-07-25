import { getTranslations } from "next-intl/server";
import type { MatchReason, MatchReasonCode } from "@/domains/matching/reasons";
import { MATCH_REASON_CODES } from "@/domains/matching/reasons";

/**
 * Presentational why-matched chips — copy only; reasons come from Matching domain.
 */
export async function WhyMatchedReasons({
  reasons,
}: {
  reasons: MatchReason[];
}) {
  if (!reasons.length) return null;
  const t = await getTranslations("providerDashboard.matchReasons");
  const known = new Set<string>(MATCH_REASON_CODES);

  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t("label")}>
      {reasons.map((r) => {
        const code = r.code as MatchReasonCode;
        const label = known.has(code)
          ? t(code, (r.params ?? {}) as Record<string, string | number>)
          : code;
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
  );
}
