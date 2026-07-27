import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SERVICE_REQUEST_MEDIA_BUCKET } from "@/lib/service-requests/constants";
import {
  buildRatingDistribution,
  emptyRatingDistribution,
} from "@/lib/reviews/trust-score";
import type {
  ProviderReviewStats,
  PublicReview,
  ReviewDimensionScores,
  ReviewSort,
} from "@/lib/reviews/types";
import { REVIEW_PAGE_SIZE } from "@/lib/reviews/types";

type ReviewRow = {
  id: string;
  provider_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
  recommend: boolean | null;
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
  is_verified: boolean;
  verified_booking: boolean;
  verified_customer: boolean;
  verified_interaction: boolean;
  helpful_count: number;
  provider_reply: string | null;
  provider_replied_at: string | null;
  language?: string | null;
  ai_summary?: string | null;
  sentiment?: string | null;
};

async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paths.length === 0) return map;
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage
      .from(SERVICE_REQUEST_MEDIA_BUCKET)
      .createSignedUrls(paths, 60 * 60);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    }
  } catch {
    // UI falls back to text-only reviews
  }
  return map;
}

export const getProviderReviewStats = cache(async function getProviderReviewStats(
  providerId: string,
  locale?: string,
): Promise<ProviderReviewStats> {
  const supabase = await createClient();
  const [{ data: provider }, { data: ratings }, reputation] = await Promise.all([
    supabase
      .from("providers")
      .select("rating_avg, review_count, trust_score")
      .eq("id", providerId)
      .maybeSingle(),
    supabase
      .from("service_reviews")
      .select("rating, id, recommend")
      .eq("provider_id", providerId)
      .eq("status", "approved")
      .is("deleted_at", null),
    loadReputationCache(providerId),
  ]);

  const ratingList = (ratings ?? []).map((r) => Number(r.rating));
  const distribution =
    ratingList.length > 0 ? buildRatingDistribution(ratingList) : emptyRatingDistribution();

  const recommendRows = (ratings ?? []).filter((r) => r.recommend != null);
  const recommendationRate =
    reputation?.recommendation_rate != null
      ? Number(reputation.recommendation_rate)
      : recommendRows.length > 0
        ? Math.round(
            (recommendRows.filter((r) => r.recommend === true).length /
              recommendRows.length) *
              1000,
          ) / 10
        : null;

  let photoCount = 0;
  if ((ratings ?? []).length > 0) {
    const ids = (ratings ?? []).map((r) => r.id);
    const { count } = await supabase
      .from("service_review_images")
      .select("id", { count: "exact", head: true })
      .in("review_id", ids);
    photoCount = count ?? 0;
  }

  const aiSummary =
    locale === "ar"
      ? reputation?.ai_summary_ar || reputation?.ai_summary_en || null
      : reputation?.ai_summary_en || reputation?.ai_summary_ar || null;

  return {
    ratingAvg: Number(provider?.rating_avg ?? 0),
    reviewCount: provider?.review_count ?? distribution.total,
    trustScore: provider?.trust_score ?? 0,
    distribution,
    photoCount,
    recommendationRate,
    qualityLabel: reputation?.quality_label ?? null,
    aiSummary,
    responseRate:
      reputation?.response_rate != null ? Number(reputation.response_rate) : null,
  };
});

async function loadReputationCache(providerId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("provider_reputation_cache")
      .select(
        "recommendation_rate, response_rate, quality_label, ai_summary_en, ai_summary_ar",
      )
      .eq("provider_id", providerId)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export async function listProviderReviews(input: {
  providerId: string;
  sort?: ReviewSort;
  page?: number;
  pageSize?: number;
  viewerId?: string | null;
  language?: string | null;
  recommendOnly?: boolean;
}): Promise<{ reviews: PublicReview[]; total: number; hasMore: boolean }> {
  const sort = input.sort ?? "newest";
  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? REVIEW_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let query = supabase
    .from("service_reviews")
    .select(
      "id, provider_id, customer_id, rating, comment, recommend, created_at, updated_at, is_anonymous, is_verified, verified_booking, verified_customer, verified_interaction, helpful_count, provider_reply, provider_replied_at, language, ai_summary, sentiment",
      { count: "exact" },
    )
    .eq("provider_id", input.providerId)
    .eq("status", "approved")
    .is("deleted_at", null);

  if (input.recommendOnly) {
    query = query.eq("recommend", true);
  }
  if (input.language) {
    query = query.eq("language", input.language);
  }

  if (sort === "highest") {
    query = query.order("rating", { ascending: false }).order("created_at", { ascending: false });
  } else if (sort === "lowest") {
    query = query.order("rating", { ascending: true }).order("created_at", { ascending: false });
  } else if (sort === "helpful") {
    query = query
      .order("helpful_count", { ascending: false })
      .order("created_at", { ascending: false });
  } else if (sort === "verified" || sort === "recommended") {
    query = query
      .order(sort === "verified" ? "is_verified" : "recommend", { ascending: false })
      .order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query.range(from, to);
  if (error || !data) {
    // Fallback without new columns
    return listProviderReviewsLegacy(input);
  }

  let rows = data as unknown as ReviewRow[];

  if (sort === "photos" && rows.length > 0) {
    const { data: imageRows } = await supabase
      .from("service_review_images")
      .select("review_id")
      .in(
        "review_id",
        rows.map((r) => r.id),
      );
    const withPhotos = new Set((imageRows ?? []).map((i) => i.review_id));
    rows = [...rows].sort((a, b) => {
      const ap = withPhotos.has(a.id) ? 1 : 0;
      const bp = withPhotos.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  const reviewIds = rows.map((r) => r.id);
  const customerIds = [
    ...new Set(rows.filter((r) => !r.is_anonymous).map((r) => r.customer_id)),
  ];

  const [imagesResult, profilesResult, voteSet, dimensionsMap] = await Promise.all([
    reviewIds.length
      ? supabase
          .from("service_review_images")
          .select("id, review_id, path, sort_order, media_kind")
          .in("review_id", reviewIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({
          data: [] as {
            id: string;
            review_id: string;
            path: string;
            sort_order: number;
            media_kind?: string | null;
          }[],
        }),
    customerIds.length
      ? supabase.from("profiles").select("user_id, display_name").in("user_id", customerIds)
      : Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[] }),
    input.viewerId && reviewIds.length
      ? loadViewerVotes(input.viewerId, reviewIds)
      : Promise.resolve(new Set<string>()),
    loadDimensionScores(reviewIds),
  ]);

  const images = imagesResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const signed = await signPaths(images.map((i) => i.path));
  const nameById = new Map(profiles.map((p) => [p.user_id, p.display_name?.trim() || ""]));

  const imagesByReview = new Map<string, PublicReview["images"]>();
  for (const img of images) {
    const list = imagesByReview.get(img.review_id) ?? [];
    list.push({
      id: img.id,
      path: img.path,
      url: signed.get(img.path) ?? "",
      mediaKind: img.media_kind ?? undefined,
    });
    imagesByReview.set(img.review_id, list);
  }

  const reviews: PublicReview[] = rows.map((row) => ({
    id: row.id,
    providerId: row.provider_id,
    rating: Number(row.rating),
    comment: row.comment,
    recommend: row.recommend,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isAnonymous: row.is_anonymous,
    isVerified: row.is_verified,
    verifiedBooking: row.verified_booking,
    verifiedCustomer: row.verified_customer,
    verifiedInteraction: row.verified_interaction,
    helpfulCount: row.helpful_count,
    providerReply: row.provider_reply,
    providerRepliedAt: row.provider_replied_at,
    customerDisplayName: row.is_anonymous ? "" : nameById.get(row.customer_id) || "",
    images: (imagesByReview.get(row.id) ?? []).filter((i) => i.url),
    viewerHasVotedHelpful: voteSet.has(row.id),
    language: row.language ?? null,
    aiSummary: row.ai_summary ?? null,
    sentiment: row.sentiment ?? null,
    dimensions: dimensionsMap.get(row.id),
  }));

  const total = count ?? reviews.length;
  return { reviews, total, hasMore: from + reviews.length < total };
}

async function listProviderReviewsLegacy(input: {
  providerId: string;
  sort?: ReviewSort;
  page?: number;
  pageSize?: number;
  viewerId?: string | null;
}): Promise<{ reviews: PublicReview[]; total: number; hasMore: boolean }> {
  const sort = input.sort ?? "newest";
  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? REVIEW_PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = await createClient();

  let query = supabase
    .from("service_reviews")
    .select(
      "id, provider_id, customer_id, rating, comment, recommend, created_at, updated_at, is_anonymous, is_verified, verified_booking, verified_customer, verified_interaction, helpful_count, provider_reply, provider_replied_at",
      { count: "exact" },
    )
    .eq("provider_id", input.providerId)
    .eq("status", "approved")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (sort === "highest") {
    query = query.order("rating", { ascending: false });
  } else if (sort === "lowest") {
    query = query.order("rating", { ascending: true });
  }

  const { data, count } = await query.range(from, to);
  const rows = (data ?? []) as unknown as ReviewRow[];
  const reviews: PublicReview[] = rows.map((row) => ({
    id: row.id,
    providerId: row.provider_id,
    rating: Number(row.rating),
    comment: row.comment,
    recommend: row.recommend,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isAnonymous: row.is_anonymous,
    isVerified: row.is_verified,
    verifiedBooking: row.verified_booking,
    verifiedCustomer: row.verified_customer,
    verifiedInteraction: row.verified_interaction,
    helpfulCount: row.helpful_count,
    providerReply: row.provider_reply,
    providerRepliedAt: row.provider_replied_at,
    customerDisplayName: "",
    images: [],
    viewerHasVotedHelpful: false,
  }));
  const total = count ?? reviews.length;
  return { reviews, total, hasMore: from + reviews.length < total };
}

async function loadDimensionScores(
  reviewIds: string[],
): Promise<Map<string, ReviewDimensionScores>> {
  const map = new Map<string, ReviewDimensionScores>();
  if (reviewIds.length === 0) return map;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("review_ratings")
      .select("review_id, dimension, score")
      .in("review_id", reviewIds);
    for (const row of data ?? []) {
      const cur = map.get(row.review_id) ?? {};
      cur[row.dimension as keyof ReviewDimensionScores] = row.score;
      map.set(row.review_id, cur);
    }
  } catch {
    /* optional */
  }
  return map;
}

async function loadViewerVotes(userId: string, reviewIds: string[]): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_review_helpful_votes")
    .select("review_id")
    .eq("user_id", userId)
    .in("review_id", reviewIds);
  return new Set((data ?? []).map((v) => v.review_id));
}

export function parseReviewSort(value: string | undefined | null): ReviewSort {
  if (
    value === "highest" ||
    value === "lowest" ||
    value === "helpful" ||
    value === "verified" ||
    value === "photos" ||
    value === "recommended" ||
    value === "language"
  ) {
    return value;
  }
  return "newest";
}
