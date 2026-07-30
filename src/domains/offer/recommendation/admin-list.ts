/**
 * Admin-only offer listing for ranking diagnostics.
 */

import type { MarketplaceOfferView } from "@/domains/offer/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOffersV2Enabled } from "@/lib/config/feature-flags";

export async function listOffersForRequestAdmin(
  requestId: string,
): Promise<MarketplaceOfferView[]> {
  if (!isOffersV2Enabled()) return [];
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return [];

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("marketplace_offers")
    .select(
      "id, service_request_id, match_assignment_id, provider_id, price, currency, price_model, inclusions, eta_text, message, expires_at, status, quality_flags, created_at",
    )
    .eq("service_request_id", requestId)
    .in("status", ["sent", "selected", "declined"])
    .order("created_at", { ascending: true });

  if (!rows?.length) return [];

  const providerIds = [...new Set(rows.map((r) => r.provider_id as string))];
  const { data: providers } = await admin
    .from("providers")
    .select("id, name, verification_status, rating_avg, review_count, avatar_image_id, metadata")
    .in("id", providerIds);

  const { fetchCompletedJobsByProviderIds } = await import("@/domains/matching");
  const jobsMap = await fetchCompletedJobsByProviderIds(providerIds);
  const pmap = new Map(
    (providers ?? []).map((p) => {
      const metadata = p.metadata as Record<string, unknown> | null;
      const displayName =
        typeof metadata?.display_name === "string"
          ? metadata.display_name.trim() || null
          : null;
      const nameJson = p.name as { en?: string; ar?: string } | string | null;
      const name =
        typeof nameJson === "string"
          ? nameJson
          : nameJson?.en?.trim() || nameJson?.ar?.trim() || null;
      return [
        p.id as string,
        {
          name,
          verification_status: p.verification_status,
          rating_avg: p.rating_avg,
          review_count: p.review_count,
          avatarUrl: null as string | null,
          displayName,
          completedJobs: jobsMap.get(p.id as string) ?? 0,
        },
      ];
    }),
  );

  return rows.map((row) => {
    const p = pmap.get(row.provider_id as string);
    return {
      id: row.id as string,
      serviceRequestId: row.service_request_id as string,
      matchAssignmentId: row.match_assignment_id as string,
      providerId: row.provider_id as string,
      providerName: p?.name ?? null,
      providerDisplayName: p?.displayName ?? null,
      providerAvatarUrl: null,
      verificationStatus: (p?.verification_status as string | null) ?? null,
      ratingAvg: p?.rating_avg != null ? Number(p.rating_avg) : null,
      reviewCount: p?.review_count != null ? Number(p.review_count) : null,
      completedJobs: p?.completedJobs ?? null,
      price: Number(row.price),
      currency: (row.currency as string) || "SYP",
      priceModel: row.price_model as MarketplaceOfferView["priceModel"],
      inclusions: (row.inclusions as string | null) ?? null,
      etaText: (row.eta_text as string | null) ?? null,
      message: (row.message as string | null) ?? null,
      expiresAt: (row.expires_at as string | null) ?? null,
      status: row.status as MarketplaceOfferView["status"],
      qualityFlags: Array.isArray(row.quality_flags)
        ? (row.quality_flags as string[])
        : [],
      createdAt: row.created_at as string,
    };
  });
}
