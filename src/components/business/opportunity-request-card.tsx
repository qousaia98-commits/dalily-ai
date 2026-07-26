import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { WhyMatchedReasons } from "@/components/business/why-matched-reasons";
import type { ProviderOpportunity } from "@/domains/offer/queries";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Clock, MapPin, Wallet } from "lucide-react";

export async function OpportunityRequestCard({
  opportunity,
}: {
  opportunity: ProviderOpportunity;
}) {
  const t = await getTranslations("offerFlow.provider");
  const tMarket = await getTranslations("dualMarketplace.opportunity");

  return (
    <Link
      href={`/business/opportunities/${opportunity.assignmentId}`}
      className="block rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">{opportunity.title}</p>
        <div className="flex flex-wrap gap-1.5">
          {opportunity.urgency === "emergency" ? (
            <Badge variant="destructive">{t("emergency")}</Badge>
          ) : null}
          {opportunity.categorySlug ? (
            <Badge variant="secondary" className="capitalize">
              {opportunity.categorySlug}
            </Badge>
          ) : null}
        </div>
      </div>

      {opportunity.aiSummary ? (
        <p className="mt-2 text-sm text-foreground/90">{opportunity.aiSummary}</p>
      ) : opportunity.intentText ? (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {opportunity.intentText}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {opportunity.preferredDate ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {opportunity.preferredDate}
          </span>
        ) : null}
        {opportunity.budget != null ? (
          <span className="inline-flex items-center gap-1">
            <Wallet className="size-3.5" aria-hidden />
            {tMarket("budget", { amount: opportunity.budget })}
          </span>
        ) : null}
        {opportunity.etaLabel ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {opportunity.etaLabel}
          </span>
        ) : null}
        {opportunity.imageCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="size-3.5" aria-hidden />
            {tMarket("photos", { count: opportunity.imageCount })}
          </span>
        ) : null}
        {opportunity.estimatedDurationLabel ? (
          <span>{opportunity.estimatedDurationLabel}</span>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {opportunity.hasOffer ? t("statusOffered") : t("statusOpen")}
      </p>

      <WhyMatchedReasons
        reasons={opportunity.reasons}
        aiMatchScore={opportunity.aiMatchScore}
        aiExplanation={opportunity.aiExplanation}
      />
    </Link>
  );
}
