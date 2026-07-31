import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getOwnedProvider } from "@/lib/providers/database";
import {
  getPublicProviderTrustProfile,
  type PublicProviderTrustExtras,
} from "@/lib/providers/public-profile";
import { getAuthUser } from "@/lib/auth/session";
import { hasPendingRequest, getProviderRequestSettings } from "@/lib/service-requests/queries";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";
import { ProviderProfileView } from "@/components/providers/provider-profile-view";
import { OfferDecisionBar } from "@/components/providers/offer-decision-bar";
import {
  getProviderReviewStats,
  listProviderReviews,
  parseReviewSort,
} from "@/lib/reviews/queries";
import { resolveTrustBadges } from "@/lib/reviews/trust-score";
import { createClient } from "@/lib/supabase/server";
import { getCustomerOfferContext } from "@/domains/offer";
import { redirect } from "@/lib/i18n/navigation";

type ProviderPageProps = {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{
    reviewSort?: string;
    reviewPage?: string;
    offerId?: string;
    requestId?: string;
  }>;
};

export async function generateMetadata({ params }: ProviderPageProps): Promise<Metadata> {
  const { id } = await params;
  const provider = await getPublicProviderTrustProfile(id);
  const locale = (await getLocale()) as Locale;

  if (!provider) return { title: "Provider" };

  return {
    title: getLocalizedText(provider.name, locale),
    description: provider.about ? getLocalizedText(provider.about, locale) : undefined,
  };
}

export default async function ProviderPage({ params, searchParams }: ProviderPageProps) {
  const { id, locale: localeParam } = await params;
  const sp = await searchParams;
  const authUser = await getAuthUser();
  const locale = (await getLocale()) as Locale;

  // Offer-decision deep links still require login (customer action on an offer).
  if (!authUser && sp.offerId) {
    const qs = new URLSearchParams();
    if (sp.offerId) qs.set("offerId", sp.offerId);
    if (sp.requestId) qs.set("requestId", sp.requestId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    redirect({
      href: `/login?redirect=${encodeURIComponent(`/providers/${id}${suffix}`)}`,
      locale: localeParam || locale,
    });
    return;
  }

  const provider = await getPublicProviderTrustProfile(id);
  if (!provider) notFound();

  const reviewSort = parseReviewSort(sp.reviewSort);
  const reviewPage = Math.max(1, Number(sp.reviewPage) || 1);

  let offerContext: Awaited<ReturnType<typeof getCustomerOfferContext>> = null;
  if (authUser && sp.offerId) {
    offerContext = await getCustomerOfferContext({
      customerId: authUser.id,
      offerId: sp.offerId,
      providerId: provider.id,
    });
  }

  const supabase = await createClient();
  const [pending, settings, reviewStats, reviewPageData, owned, servicesResult, publicTrust] =
    await Promise.all([
      authUser ? hasPendingRequest(authUser.id, provider.id) : Promise.resolve(false),
      getProviderRequestSettings(provider.id),
      getProviderReviewStats(provider.id, locale),
      listProviderReviews({
        providerId: provider.id,
        sort: reviewSort,
        page: reviewPage,
        viewerId: authUser?.id,
        language: reviewSort === "language" ? locale : null,
        recommendOnly: reviewSort === "recommended",
      }),
      authUser ? getOwnedProvider(authUser.id) : Promise.resolve(null),
      supabase
        .from("provider_services")
        .select("id, name")
        .eq("provider_id", provider.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order"),
      (async () => {
        const { getPublicTrustView } = await import("@/lib/reputation/public");
        return getPublicTrustView(provider.id, locale === "ar" ? "ar" : "en");
      })(),
    ]);

  const trustBadges = resolveTrustBadges({
    ratingAvg: reviewStats.ratingAvg || provider.rating,
    reviewCount: reviewStats.reviewCount || provider.reviewCount,
    trustScore: reviewStats.trustScore || provider.trustScore,
    verified: provider.verified,
    responseTimeHours: provider.responseTimeHours,
    completedJobs: provider.stats.completedJobs,
  });

  const bookingServices = (servicesResult.data ?? []).map((row) => ({
    id: row.id,
    name: getLocalizedText(
      (row.name ?? { ar: "", en: "" }) as { ar: string; en: string },
      locale,
    ),
  }));

  const trustExtras: PublicProviderTrustExtras = {
    workingHours: provider.workingHours,
    languages: provider.languages,
    headline: provider.headline,
    displayName: provider.displayName,
    experience: provider.experience,
    specializations: provider.specializations,
    skills: provider.skills,
    certificates: provider.certificates,
    awards: provider.awards,
    stats: provider.stats,
    serviceCities: provider.serviceCities,
    serviceItems: provider.serviceItems,
    portfolio: provider.portfolio,
    availabilityStatus: provider.availabilityStatus,
    publicTrustScorePct: provider.publicTrustScorePct,
    visibility: provider.visibility,
  };

  const offerDecisionMode = Boolean(offerContext);

  return (
    <main className="flex flex-1 flex-col pb-16 pt-0">
      <ProviderProfileView
        provider={provider}
        trustExtras={trustExtras}
        isLoggedIn={Boolean(authUser)}
        hasPendingRequest={pending}
        acceptingRequests={settings.accepting_requests && !settings.vacation_mode}
        estimatedResponseHours={settings.estimated_response_hours}
        reviewStats={reviewStats}
        reviews={reviewPageData.reviews}
        reviewTotal={reviewPageData.total}
        reviewHasMore={reviewPageData.hasMore}
        reviewPage={reviewPage}
        reviewSort={reviewSort}
        trustBadges={trustBadges}
        canVoteReviews={Boolean(authUser)}
        canReplyReviews={Boolean(owned && owned.id === provider.id)}
        bookingServices={bookingServices}
        offerDecisionMode={offerDecisionMode}
        publicTrust={
          publicTrust ?? {
            providerId: provider.id,
            trustLevel: "new_provider",
            trend: "stable",
            explanations: [],
            verificationBadges: provider.verified ? ["verified"] : [],
          }
        }
      />
      {offerContext ? (
        <OfferDecisionBar
          offerId={offerContext.offerId}
          requestId={offerContext.serviceRequestId}
          canDecide={offerContext.canDecide}
          backHref={
            sp.requestId
              ? `/request/${sp.requestId}/waiting`
              : `/request/${offerContext.serviceRequestId}/waiting`
          }
        />
      ) : null}
    </main>
  );
}
