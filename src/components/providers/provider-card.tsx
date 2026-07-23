import Image from "next/image";
import { Clock, MapPin } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlanBadge } from "@/components/shared/plan-badge";
import { StarRating } from "@/components/providers/star-rating";
import { SerpClickLink } from "@/components/providers/serp-click-link";
import { MatchReasonsList } from "@/components/search/match-reasons-list";
import { getLocalizedText } from "@/types/domain.types";
import type { ProviderListItem } from "@/types/search.types";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { getBenefits } from "@/lib/subscription/benefit-engine";

type ProviderCardProps = {
  provider: ProviderListItem;
  className?: string;
  style?: React.CSSProperties;
  position?: number;
  /** Show Smart Match recommendation reasons */
  showMatchReasons?: boolean;
};

export async function ProviderCard({
  provider,
  className,
  style,
  position,
  showMatchReasons = true,
}: ProviderCardProps) {
  const locale = (await getLocale()) as Locale;
  const tProvider = await getTranslations("provider");
  const tMatch = await getTranslations("search.match");
  const providerName = getLocalizedText(provider.name, locale);
  const planSlug = provider.planSlug ?? "free";
  const benefits = getBenefits(planSlug);
  const health = provider.profileCompleteness ?? provider.trustScore;
  const reasons = provider.matchReasons ?? [];

  return (
    <SerpClickLink
      providerId={provider.id}
      position={position}
      href={`/providers/${provider.id}`}
      className={cn("group block", className)}
      style={style}
    >
      <Card
        className={cn(
          "overflow-hidden py-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          benefits.showPremiumSearchAppearance && "ring-1 ring-[var(--dalily-gold)]/40",
        )}
      >
        <div className="relative aspect-[16/9] overflow-hidden">
          <Image
            src={provider.coverImage}
            alt={providerName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
            {provider.verified ? (
              <Badge variant="success">{tProvider("verified")}</Badge>
            ) : null}
            {benefits.canAppearFeatured ? (
              <Badge className="bg-[var(--dalily-navy)] text-[var(--dalily-gold)]">
                {tProvider("featured")}
              </Badge>
            ) : null}
          </div>
        </div>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
              <Image
                src={provider.avatarImage}
                alt={providerName}
                fill
                className="object-cover"
                sizes="44px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate font-semibold group-hover:text-primary">{providerName}</h3>
                <PlanBadge planSlug={planSlug} />
              </div>
              <p className="text-sm text-muted-foreground">
                {getLocalizedText(provider.categoryLabel, locale)}
              </p>
            </div>
            <div className="text-end">
              <p className="text-sm font-bold text-primary">{health}%</p>
              <p className="text-xs text-muted-foreground">{tProvider("healthShort")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <StarRating rating={provider.rating} />
            <span>({provider.reviewCount})</span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {getLocalizedText(provider.city, locale)}
            </span>
            {provider.distanceKm != null ? (
              <span className="flex items-center gap-1 font-medium text-foreground">
                <MapPin className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
                {tProvider("distanceAway", { km: provider.distanceKm })}
              </span>
            ) : null}
            {provider.responseTimeHours != null ? (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {provider.responseTimeHours <= 1
                  ? tMatch("respondsMinutes", {
                      minutes: Math.max(5, Math.round(provider.responseTimeHours * 60)),
                    })
                  : tProvider("respondsIn", { hours: provider.responseTimeHours })}
              </span>
            ) : null}
            {provider.completedJobs != null && provider.completedJobs > 0 ? (
              <span className="text-xs font-medium text-foreground">
                {tMatch("completedJobs", { count: provider.completedJobs })}
              </span>
            ) : null}
          </div>

          {showMatchReasons && reasons.length > 0 ? (
            <div className="border-t border-border/60 pt-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-foreground">{tMatch("whyRecommended")}</p>
                {provider.matchConfidence ? (
                  <Badge variant="outline" className="text-[10px]">
                    {tMatch(`confidence.${provider.matchConfidence}`)}
                  </Badge>
                ) : null}
              </div>
              <MatchReasonsList reasons={reasons} />
            </div>
          ) : provider.matchConfidence ? (
            <div className="border-t border-border/60 pt-3">
              <Badge variant="outline" className="text-[10px]">
                {tMatch(`confidence.${provider.matchConfidence}`)}
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </SerpClickLink>
  );
}
