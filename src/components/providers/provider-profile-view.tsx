import Image from "next/image";
import { MapPin, Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";
import type { PublicProviderProfile } from "@/lib/providers/database";
import type { PublicProviderTrustExtras } from "@/lib/providers/public-profile";
import { StarRating } from "@/components/providers/star-rating";
import { TrustScore } from "@/components/providers/trust-score";
import { PublicVerificationBadge } from "@/components/verification/public-verification-badge";
import { Badge } from "@/components/ui/badge";
import { PlanBadge } from "@/components/shared/plan-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendRequestButton } from "@/components/providers/send-request-button";
import { TrackProfileView } from "@/components/providers/track-profile-view";
import { ProviderReviewsSection } from "@/components/reviews/provider-reviews-section";
import { TrustBadgeList } from "@/components/reviews/trust-badge-list";
import { PublicTrustPanel } from "@/components/reviews/public-trust-panel";
import type { PublicTrustView } from "@/lib/reputation/types";
import type { PublicReview, ProviderReviewStats, ReviewSort } from "@/lib/reviews/types";
import type { TrustBadgeId } from "@/lib/reviews/trust-score";
import { BookingForm } from "@/components/booking/booking-form";
import { isSmartBookingEnabled } from "@/lib/config/feature-flags";
import { ProviderGalleryLazy } from "@/components/providers/provider-gallery-lazy";
import { ProviderPublicStatsGrid } from "@/components/providers/provider-public-stats";

type ProviderProfileViewProps = {
  provider: PublicProviderProfile;
  trustExtras?: PublicProviderTrustExtras | null;
  isLoggedIn?: boolean;
  hasPendingRequest?: boolean;
  acceptingRequests?: boolean;
  estimatedResponseHours?: number;
  reviewStats: ProviderReviewStats;
  reviews: PublicReview[];
  reviewTotal: number;
  reviewHasMore: boolean;
  reviewPage: number;
  reviewSort: ReviewSort;
  trustBadges: TrustBadgeId[];
  canVoteReviews: boolean;
  canReplyReviews?: boolean;
  bookingServices?: { id: string; name: string }[];
  publicTrust: PublicTrustView;
  offerDecisionMode?: boolean;
};

export async function ProviderProfileView({
  provider,
  trustExtras = null,
  isLoggedIn = false,
  hasPendingRequest = false,
  acceptingRequests = true,
  estimatedResponseHours,
  reviewStats,
  reviews,
  reviewTotal,
  reviewHasMore,
  reviewPage,
  reviewSort,
  trustBadges,
  canVoteReviews,
  canReplyReviews = false,
  bookingServices = [],
  publicTrust,
  offerDecisionMode = false,
}: ProviderProfileViewProps) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("provider");

  const cityLabel = getLocalizedText(provider.city, locale);
  const businessName = getLocalizedText(provider.name, locale);
  const displayName = trustExtras?.displayName?.trim() || businessName;
  const headline = trustExtras?.headline?.trim() || null;
  const stats = trustExtras?.stats;
  const visibility = trustExtras?.visibility;
  const weekdayFormatter = new Intl.DateTimeFormat(locale === "ar" ? "ar" : "en", {
    weekday: "long",
  });
  const weekdayLabel = (dayOfWeek: number) =>
    weekdayFormatter.format(new Date(Date.UTC(2024, 0, 7 + dayOfWeek)));

  const trustPct =
    trustExtras?.publicTrustScorePct ??
    Math.max(1, Math.min(99, Math.round(provider.trustScore)));

  return (
    <div className={`animate-fade-in ${offerDecisionMode ? "pb-28" : ""}`}>
      <TrackProfileView providerId={provider.id} />
      <div className="relative h-48 overflow-hidden sm:h-64 md:h-72">
        <Image
          src={provider.coverImage}
          alt={businessName}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="-mt-16 relative mb-8 flex flex-col gap-4 sm:-mt-20 sm:flex-row sm:items-end">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background shadow-lg sm:size-32">
            <Image
              src={provider.avatarImage}
              alt={businessName}
              fill
              className="object-cover"
              sizes="128px"
              priority
            />
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:pb-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">{businessName}</h1>
                {provider.verified ? (
                  <PublicVerificationBadge
                    providerId={provider.id}
                    verified
                    size="md"
                  />
                ) : null}
                <PlanBadge planSlug={provider.planSlug} size="md" />
                {provider.planSlug === "premium" ? (
                  <Badge className="border border-[var(--dalily-gold)]/50 bg-[var(--dalily-gold)]/10 text-[var(--dalily-navy)]">
                    {t("featured")}
                  </Badge>
                ) : null}
              </div>
              {displayName !== businessName ? (
                <p className="mt-1 text-sm font-medium text-foreground/80">{displayName}</p>
              ) : null}
              {headline ? (
                <p className="mt-1 text-sm text-muted-foreground">{headline}</p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  {getLocalizedText(provider.categoryLabel, locale)}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <TrustScore score={trustPct} verified={provider.verified} size="lg" showBar />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <StarRating rating={provider.rating} size="md" />
              <span>
                {provider.reviewCount} {t("reviews")}
              </span>
              {visibility?.showCompletedJobs !== false && stats ? (
                <span>
                  {t("completedJobsShort", { count: stats.completedJobs })}
                </span>
              ) : null}
              <TrustBadgeList badges={trustBadges.slice(0, 3)} />
              {visibility?.showServiceArea !== false ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" />
                  {cityLabel}
                </span>
              ) : null}
              {provider.responseTimeHours != null ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-4" />
                  {t("respondsIn", { hours: provider.responseTimeHours })}
                </span>
              ) : null}
              {stats ? (
                <span>
                  {t("memberSince", { date: new Date(provider.memberSince).getFullYear() })}
                </span>
              ) : null}
              {trustExtras?.availabilityStatus ? (
                <Badge variant="secondary">
                  {t(`availability.${trustExtras.availabilityStatus}`)}
                </Badge>
              ) : null}
            </div>

            {visibility?.showLanguages !== false &&
            trustExtras &&
            trustExtras.languages.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {trustExtras.languages.map((lang) => (
                  <Badge key={lang} variant="outline">
                    {lang}
                  </Badge>
                ))}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">{t("trustOnlyNote")}</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {provider.about || trustExtras?.experience ? (
              <section id="provider-about">
                <h2 className="mb-3 text-lg font-semibold">{t("about")}</h2>
                {provider.about ? (
                  <p className="leading-relaxed text-muted-foreground">
                    {getLocalizedText(provider.about, locale)}
                  </p>
                ) : null}
                {trustExtras?.experience ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {trustExtras.experience}
                  </p>
                ) : null}
                {trustExtras && trustExtras.specializations.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {trustExtras.specializations.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {trustExtras && trustExtras.skills.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {trustExtras.skills.map((s) => (
                      <Badge key={s} variant="outline">
                        {s}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            {trustExtras && trustExtras.serviceItems.length > 0 ? (
              <section id="provider-services">
                <h2 className="mb-3 text-lg font-semibold">{t("services")}</h2>
                <ul className="space-y-3">
                  {trustExtras.serviceItems.map((service) => (
                    <li
                      key={service.id}
                      className="rounded-2xl border border-border/70 px-3.5 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-medium">
                          {getLocalizedText(service.name, locale)}
                        </p>
                        {service.startingPrice != null ? (
                          <span className="text-sm font-semibold text-[var(--dalily-navy)] dark:text-[var(--dalily-gold)]">
                            {t("fromPrice", {
                              price: service.startingPrice,
                              currency: service.currency ?? "SYP",
                            })}
                          </span>
                        ) : null}
                      </div>
                      {service.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {getLocalizedText(service.description, locale)}
                        </p>
                      ) : null}
                      {service.estimatedResponseHours != null ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("respondsIn", {
                            hours: service.estimatedResponseHours,
                          })}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {getLocalizedText(provider.categoryLabel, locale)}
                  </Badge>
                  {(trustExtras.serviceCities ?? []).map((city) => (
                    <Badge key={city} variant="outline">
                      {city}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : provider.services.length > 0 ? (
              <section id="provider-services">
                <h2 className="mb-3 text-lg font-semibold">{t("services")}</h2>
                <div className="flex flex-wrap gap-2">
                  {provider.services.map((service) => (
                    <Badge
                      key={service.ar + service.en}
                      variant="secondary"
                      className="px-3 py-1.5 text-sm"
                    >
                      {getLocalizedText(service, locale)}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            {visibility?.showStatistics !== false && stats ? (
              <ProviderPublicStatsGrid
                stats={stats}
                showCompletedJobs={visibility?.showCompletedJobs !== false}
              />
            ) : null}

            {trustExtras &&
            trustExtras.workingHours.some((h) => h.opensAt || h.isClosed) ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold">{t("workingHours")}</h2>
                <ul className="space-y-1.5 text-sm">
                  {trustExtras.workingHours.map((hour) => (
                    <li
                      key={hour.dayOfWeek}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2"
                    >
                      <span className="font-medium">{weekdayLabel(hour.dayOfWeek)}</span>
                      <span className="text-muted-foreground">
                        {hour.isClosed || !hour.opensAt || !hour.closesAt
                          ? t("closedDay")
                          : `${hour.opensAt} – ${hour.closesAt}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {visibility?.showCertificates !== false &&
            trustExtras &&
            trustExtras.certificates.length > 0 ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold">{t("certificates")}</h2>
                <div className="flex flex-wrap gap-2">
                  {trustExtras.certificates.map((c) => (
                    <Badge key={c} variant="outline">
                      {c}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            {trustExtras && trustExtras.awards.length > 0 ? (
              <section>
                <h2 className="mb-3 text-lg font-semibold">{t("awards")}</h2>
                <div className="flex flex-wrap gap-2">
                  {trustExtras.awards.map((a) => (
                    <Badge key={a} className="bg-[var(--dalily-gold)]/15 text-foreground">
                      {a === "verified" ? t("verified") : a}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            {visibility?.showGallery !== false ? (
              <ProviderGalleryLazy
                items={trustExtras?.portfolio ?? []}
                alt={businessName}
              />
            ) : null}

            <div id="provider-reviews">
              <ProviderReviewsSection
                providerId={provider.id}
                stats={reviewStats}
                reviews={reviews}
                total={reviewTotal}
                hasMore={reviewHasMore}
                page={reviewPage}
                sort={reviewSort}
                badges={trustBadges}
                canVote={canVoteReviews}
                canReply={canReplyReviews}
              />
            </div>
          </div>

          <div className="space-y-4">
            {!offerDecisionMode ? (
              <Card className="border-[var(--dalily-gold)]/25 bg-[color-mix(in_oklab,var(--dalily-gold)_6%,var(--card))]">
                <CardHeader>
                  <CardTitle>{t("requestService")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t("requestServiceBody")}</p>
                  {estimatedResponseHours ? (
                    <p className="text-xs text-muted-foreground">
                      {t("estimatedResponse", { hours: estimatedResponseHours })}
                    </p>
                  ) : null}
                  {!acceptingRequests ? (
                    <p className="rounded-2xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {t("notAccepting")}
                    </p>
                  ) : (
                    <SendRequestButton
                      providerId={provider.id}
                      providerName={businessName}
                      isLoggedIn={isLoggedIn}
                      hasPendingRequest={hasPendingRequest}
                    />
                  )}
                </CardContent>
              </Card>
            ) : null}

            {!offerDecisionMode ? (
              <BookingForm
                providerId={provider.id}
                services={bookingServices}
                isLoggedIn={isLoggedIn}
                smartBookingEnabled={isSmartBookingEnabled()}
              />
            ) : null}

            <PublicTrustPanel trust={publicTrust} />
          </div>
        </div>
      </div>
    </div>
  );
}
