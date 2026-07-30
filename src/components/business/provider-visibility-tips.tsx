import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { ProviderVisibilityTip } from "@/domains/offer/recommendation";
import { Sparkles } from "lucide-react";

const TIP_HREF: Record<ProviderVisibilityTip["code"], string> = {
  complete_profile: "/business/profile",
  get_verified: "/business/verification",
  collect_reviews: "/business/quality",
  improve_response: "/business/availability",
  reduce_cancellations: "/business/quality",
  add_portfolio: "/business/media",
  stay_available: "/business/availability",
};

/**
 * Provider-facing visibility tips — never reveals ranking weights.
 */
export async function ProviderVisibilityTipsCard({
  tips,
}: {
  tips: ProviderVisibilityTip[];
}) {
  const t = await getTranslations("providerDashboard.visibility");
  if (tips.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-border bg-muted/20 p-4 animate-fade-in"
      aria-labelledby="visibility-tips-title"
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-[var(--dalily-gold)]" aria-hidden />
        <h2 id="visibility-tips-title" className="text-sm font-semibold">
          {t("title")}
        </h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("subtitle")}</p>
      <ul className="space-y-2">
        {tips.map((tip) => (
          <li
            key={tip.code}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium">{t(`tips.${tip.code}.title`)}</p>
              <p className="text-xs text-muted-foreground">
                {t(`tips.${tip.code}.body`)}
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="rounded-xl shrink-0">
              <Link href={TIP_HREF[tip.code]}>{t("cta")}</Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
