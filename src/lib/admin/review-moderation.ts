/**
 * Review Moderation — admin overlay on service_reviews + AI flags.
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
  aiSummary: string | null;
  sentiment: string | null;
  fakeRisk: number | null;
  flags: Array<{ type: string; severity: string; reason: string | null }>;
  deleteRequested: boolean;
  moderationHistory: Array<{ action: string; note: string | null; at: string }>;
};

export async function listReviewsForModeration(params?: {
  filter?: "newest" | "low" | "hidden" | "pending" | "flagged" | "delete_requests";
  limit?: number;
}): Promise<AdminModerationReview[]> {
  const admin = createAdminClient();
  const limit = params?.limit ?? 40;
  const filter = params?.filter ?? "newest";

  let query = admin
    .from("service_reviews")
    .select(
      "id, provider_id, customer_id, rating, comment, status, created_at, is_verified, deleted_at, ai_summary, sentiment, delete_requested_at",
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
  } else if (filter === "delete_requests") {
    query = query.not("delete_requested_at", "is", null);
  }

  const { data } = await query;
  let rows = data ?? [];

  if (filter === "flagged") {
    const { data: flagRows } = await admin
      .from("review_flags")
      .select("review_id")
      .is("resolved_at", null)
      .limit(200);
    const flaggedIds = new Set((flagRows ?? []).map((f) => f.review_id));
    rows = rows.filter((r) => flaggedIds.has(r.id));
  }

  const ids = rows.map((r) => r.id);
  const [flags, history, analyses] = await Promise.all([
    ids.length
      ? admin
          .from("review_flags")
          .select("review_id, flag_type, severity, reason")
          .in("review_id", ids)
          .is("resolved_at", null)
      : Promise.resolve({
          data: [] as Array<{
            review_id: string;
            flag_type: string;
            severity: string;
            reason: string | null;
          }>,
        }),
    ids.length
      ? admin
          .from("review_moderation")
          .select("review_id, action, note, created_at")
          .in("review_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as Array<{
            review_id: string;
            action: string;
            note: string | null;
            created_at: string;
          }>,
        }),
    ids.length
      ? admin
          .from("review_ai_analysis")
          .select("review_id, fake_risk_score")
          .in("review_id", ids)
      : Promise.resolve({
          data: [] as Array<{ review_id: string; fake_risk_score: number }>,
        }),
  ]);

  const flagsBy = new Map<string, AdminModerationReview["flags"]>();
  for (const f of flags.data ?? []) {
    const list = flagsBy.get(f.review_id) ?? [];
    list.push({ type: f.flag_type, severity: f.severity, reason: f.reason });
    flagsBy.set(f.review_id, list);
  }
  const histBy = new Map<string, AdminModerationReview["moderationHistory"]>();
  for (const h of history.data ?? []) {
    const list = histBy.get(h.review_id) ?? [];
    list.push({ action: h.action, note: h.note, at: h.created_at });
    histBy.set(h.review_id, list);
  }
  const riskBy = new Map(
    (analyses.data ?? []).map((a) => [a.review_id, Number(a.fake_risk_score)]),
  );

  return rows.map((row) => ({
    id: row.id,
    providerId: row.provider_id,
    customerId: row.customer_id,
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
    isVerified: row.is_verified,
    aiSummary: (row as { ai_summary?: string | null }).ai_summary ?? null,
    sentiment: (row as { sentiment?: string | null }).sentiment ?? null,
    fakeRisk: riskBy.get(row.id) ?? null,
    flags: flagsBy.get(row.id) ?? [],
    deleteRequested: Boolean(
      (row as { delete_requested_at?: string | null }).delete_requested_at,
    ),
    moderationHistory: (histBy.get(row.id) ?? []).slice(0, 5),
  }));
}

/** Spam / fake-review detection is wired via heuristic AI analysis. */
export function spamDetectionReady(): boolean {
  return true;
}
