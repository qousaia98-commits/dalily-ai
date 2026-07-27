import { getTranslations } from "next-intl/server";
import type { PublicTrustView } from "@/lib/reputation/types";

type Props = {
  trust: PublicTrustView;
};

/** Public trust indicators — never shows internal numeric scores. */
export async function PublicTrustPanel({ trust }: Props) {
  const t = await getTranslations("reviews.trustLevel");

  return (
    <aside className="space-y-3 rounded-2xl border border-border/80 bg-card p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("eyebrow")}
        </p>
        <p className="text-lg font-semibold text-[var(--dalily-navy)]">
          {t(trust.trustLevel)}
        </p>
        {trust.trend === "rising" ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">{t("rising")}</p>
        ) : null}
      </div>
      {trust.explanations.length > 0 ? (
        <ul className="space-y-2">
          {trust.explanations.map((e) => (
            <li key={e.key} className="text-sm leading-relaxed text-foreground/90">
              “{e.body}”
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("fallback")}</p>
      )}
    </aside>
  );
}
