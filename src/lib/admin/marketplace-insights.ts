import { createAdminClient } from "@/lib/supabase/admin";
import { hasRankingSnapshotColumn } from "@/lib/search/schema-capabilities";

export type MarketplaceInsights = {
  topCategories: { slug: string; count: number }[];
  topCities: { slug: string; count: number }[];
  mostViewedBusinesses: { providerId: string; views: number }[];
  mostActiveBusinesses: { providerId: string; events: number }[];
  averageCustomerDistanceKm: number | null;
  searchImpressions: number;
  conversions: number;
  totalSearches: number;
};

/**
 * Admin marketplace metrics — real aggregates only.
 */
export async function getMarketplaceInsights(): Promise<MarketplaceInsights> {
  const empty: MarketplaceInsights = {
    topCategories: [],
    topCities: [],
    mostViewedBusinesses: [],
    mostActiveBusinesses: [],
    averageCustomerDistanceKm: null,
    searchImpressions: 0,
    conversions: 0,
    totalSearches: 0,
  };

  try {
    const admin = createAdminClient();
    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const since = weekAgo.toISOString();
    const useSnapshots = await hasRankingSnapshotColumn();

    const query = useSnapshots
      ? admin
          .from("search_logs")
          .select("category_slug, city_slug, ranking_snapshot, provider_ids")
          .gte("created_at", since)
          .limit(5000)
      : admin
          .from("search_logs")
          .select("category_slug, city_slug, provider_ids")
          .gte("created_at", since)
          .limit(5000);

    const { data: logs, error } = await query;

    if (error) {
      console.error("[marketplace]", error.message);
      return empty;
    }

    const categoryCounts = new Map<string, number>();
    const cityCounts = new Map<string, number>();
    const distances: number[] = [];

    for (const log of logs ?? []) {
      if (log.category_slug) {
        categoryCounts.set(
          log.category_slug,
          (categoryCounts.get(log.category_slug) ?? 0) + 1,
        );
      }
      if (log.city_slug) {
        cityCounts.set(log.city_slug, (cityCounts.get(log.city_slug) ?? 0) + 1);
      }
      if (useSnapshots) {
        const snap = (log as { ranking_snapshot?: unknown }).ranking_snapshot;
        if (Array.isArray(snap)) {
          for (const entry of snap) {
            const km = (entry as { distanceKm?: number | null })?.distanceKm;
            if (typeof km === "number" && Number.isFinite(km)) distances.push(km);
          }
        }
      }
    }

  const topCategories = [...categoryCounts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topCities = [...cityCounts.entries()]
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const { data: viewEvents } = await admin
    .from("provider_engagement_events")
    .select("provider_id, event_type")
    .gte("created_at", since)
    .limit(8000);

  const viewCounts = new Map<string, number>();
  const activeCounts = new Map<string, number>();
  let searchImpressions = 0;
  let conversions = 0;

  for (const ev of viewEvents ?? []) {
    activeCounts.set(ev.provider_id, (activeCounts.get(ev.provider_id) ?? 0) + 1);
    if (ev.event_type === "profile_view") {
      viewCounts.set(ev.provider_id, (viewCounts.get(ev.provider_id) ?? 0) + 1);
    }
    if (ev.event_type === "impression") searchImpressions += 1;
    if (ev.event_type === "contact_phone" || ev.event_type === "contact_whatsapp") {
      conversions += 1;
    }
  }

  const mostViewedBusinesses = [...viewCounts.entries()]
    .map(([providerId, views]) => ({ providerId, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  const mostActiveBusinesses = [...activeCounts.entries()]
    .map(([providerId, events]) => ({ providerId, events }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 8);

  const averageCustomerDistanceKm =
    distances.length > 0
      ? Math.round((distances.reduce((a, b) => a + b, 0) / distances.length) * 10) / 10
      : null;

  return {
    topCategories,
    topCities,
    mostViewedBusinesses,
    mostActiveBusinesses,
    averageCustomerDistanceKm,
    searchImpressions,
    conversions,
    totalSearches: logs?.length ?? 0,
  };
  } catch (e) {
    console.error("[marketplace] unexpected:", e);
    return empty;
  }
}
