/**
 * Review Moderation — admin overlay on service_reviews (no core review engine changes).
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type AdminModerationReview = {
  id: string;
  providerId: string;
  customerId: string;
  rating: number;
  comment: string | null;
  status: string;
  createdAt: string;
  isVerified: boolean;
};

export async function listReviewsForModeration(params?: {
  filter?: "newest" | "low" | "hidden" | "pending";
  limit?: number;
}): Promise<AdminModerationReview[]> {
  const admin = createAdminClient();
  const limit = params?.limit ?? 40;
  const filter = params?.filter ?? "newest";

  let query = admin
    .from("service_reviews")
    .select(
      "id, provider_id, customer_id, rating, comment, status, created_at, is_verified, deleted_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter === "low") {
    query = query.lte("rating", 2);
  } else if (filter === "hidden") {
    query = query.eq("status", "hidden");
  } else if (filter === "pending") {
    query = query.eq("status", "pending");
  }

  const { data } = await query;
  return (data ?? []).map((row) => ({
    id: row.id,
    providerId: row.provider_id,
    customerId: row.customer_id,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
    isVerified: row.is_verified,
  }));
}

/** Architecture stub — spam scoring hook (not implemented). */
export function spamDetectionReady(): boolean {
  return true;
}
