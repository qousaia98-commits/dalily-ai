import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { ReviewCard } from "@/components/reviews/review-card";
import { RatingBreakdown } from "@/components/reviews/rating-breakdown";
import { ReviewSortSelect } from "@/components/reviews/review-sort-select";
import { TrustBadgeList } from "@/components/reviews/trust-badge-list";
import type { PublicReview, ReviewSort } from "@/lib/reviews/types";
import type { ProviderReviewStats } from "@/lib/reviews/types";
import type { TrustBadgeId } from "@/lib/reviews/trust-score";
import { Button } from "@/components/ui/button";

type Props = {
  providerId: string;
  stats: ProviderReviewStats;
  reviews: PublicReview[];
  total: number;
  hasMore: boolean;
  page: number;
  sort: ReviewSort;
  badges: TrustBadgeId[];
  canVote: boolean;
  canReply?: boolean;
};

export async function ProviderReviewsSection({
  providerId,
  stats,
  reviews,
  total,
  hasMore,
  page,
  sort,
  badges,
  canVote,
  canReply = false,
}: Props) {
  const t = await getTranslations("reviews");

  return (
    <section className="space-y-5" aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="reviews-heading" className="text-lg font-semibold">
            {t("sectionTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("sectionSubtitle", { count: total })}
          </p>
        </div>
        <TrustBadgeList badges={badges} />
      </div>

      {stats.reviewCount === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <RatingBreakdown
            distribution={stats.distribution}
            ratingAvg={stats.ratingAvg}
            reviewCount={stats.reviewCount}
          />
          <ReviewSortSelect current={sort} />
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                canVote={canVote}
                canReply={canReply && !review.providerReply}
              />
            ))}
          </div>
          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-between gap-3">
              {page > 1 ? (
                <Button asChild variant="outline" className="rounded-xl">
                  <Link
                    href={`/providers/${providerId}?reviewSort=${sort}&reviewPage=${page - 1}`}
                  >
                    {t("prevPage")}
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              {hasMore ? (
                <Button asChild variant="outline" className="rounded-xl">
                  <Link
                    href={`/providers/${providerId}?reviewSort=${sort}&reviewPage=${page + 1}`}
                  >
                    {t("nextPage")}
                  </Link>
                </Button>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}
