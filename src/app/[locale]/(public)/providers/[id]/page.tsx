import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPublicProviderById, getOwnedProvider } from "@/lib/providers/database";
import { getAuthUser } from "@/lib/auth/session";
import { hasPendingRequest, getProviderRequestSettings } from "@/lib/service-requests/queries";
import { getLocalizedText } from "@/types/domain.types";
import type { Locale } from "@/lib/i18n/config";
import { ProviderProfileView } from "@/components/providers/provider-profile-view";
import {
  getProviderReviewStats,
  listProviderReviews,
  parseReviewSort,
} from "@/lib/reviews/queries";
import { resolveTrustBadges } from "@/lib/reviews/trust-score";
import { fetchCompletedJobsByProviderIds } from "@/lib/search/smart-match";

type ProviderPageProps = {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ reviewSort?: string; reviewPage?: string }>;
};

export async function generateMetadata({ params }: ProviderPageProps): Promise<Metadata> {
  const { id } = await params;
  const provider = await getPublicProviderById(id);
  const locale = (await getLocale()) as Locale;

  if (!provider) return { title: "Provider" };

  return {
    title: getLocalizedText(provider.name, locale),
    description: provider.about ? getLocalizedText(provider.about, locale) : undefined,
  };
}

export default async function ProviderPage({ params, searchParams }: ProviderPageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const provider = await getPublicProviderById(id);
  if (!provider) notFound();

  const authUser = await getAuthUser();
  const reviewSort = parseReviewSort(sp.reviewSort);
  const reviewPage = Math.max(1, Number(sp.reviewPage) || 1);

  const [pending, settings, reviewStats, reviewPageData, jobsMap, owned] = await Promise.all([
    authUser != null ? hasPendingRequest(authUser.id, provider.id) : Promise.resolve(false),
    getProviderRequestSettings(provider.id),
    getProviderReviewStats(provider.id),
    listProviderReviews({
      providerId: provider.id,
      sort: reviewSort,
      page: reviewPage,
      viewerId: authUser?.id ?? null,
    }),
    fetchCompletedJobsByProviderIds([provider.id]),
    authUser ? getOwnedProvider(authUser.id) : Promise.resolve(null),
  ]);

  const trustBadges = resolveTrustBadges({
    ratingAvg: reviewStats.ratingAvg || provider.rating,
    reviewCount: reviewStats.reviewCount || provider.reviewCount,
    trustScore: reviewStats.trustScore || provider.trustScore,
    verified: provider.verified,
    responseTimeHours: provider.responseTimeHours,
    completedJobs: jobsMap.get(provider.id) ?? 0,
  });

  return (
    <main className="flex flex-1 flex-col pb-16 pt-0">
      <ProviderProfileView
        provider={provider}
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
      />
    </main>
  );
}
