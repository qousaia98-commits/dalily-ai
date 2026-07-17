import { createAdminClient } from "@/lib/supabase/admin";
import { calculateGrowthPotential, type GrowthPotentialResult } from "@/lib/business/growth-potential";
import { citySlugFromId } from "@/lib/providers/reference";
import { SAMPLE_DISTRICT_LABELS } from "@/lib/geo/city-centroids";
import { hasRankingSnapshotColumn } from "@/lib/search/schema-capabilities";
import type { Locale } from "@/lib/i18n/config";
import type { PlanSlug } from "@/lib/subscription/types";

export type WeeklyInsights = {
  profileViews: number | null;
  phoneClicks: number | null;
  whatsappClicks: number | null;
  favorites: number | null;
  reviews: number;
  searchAppearances: number;
  contactClicks: number | null;
  conversions: number | null;
};

export type LocationInsights = {
  topVisitorArea: string;
  averageCustomerDistanceKm: number | null;
  nearbySearchesThisWeek: number;
  peakSearchDay: string | null;
  citySharePercent: number | null;
};

export type ProviderAnalyticsBundle = {
  weekly: WeeklyInsights;
  growth: GrowthPotentialResult;
  location: LocationInsights;
  impressions: number;
  serpClicks: number;
};

async function countEvents(
  providerId: string,
  eventTypes: string[],
  sinceIso: string,
): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("provider_engagement_events")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .in("event_type", eventTypes)
    .gte("created_at", sinceIso);

  if (error) {
    // Table may not exist yet before migration
    console.error("[analytics] countEvents:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getWeeklyInsights(
  providerId: string,
  reviewCount: number,
): Promise<WeeklyInsights> {
  const empty: WeeklyInsights = {
    profileViews: null,
    phoneClicks: null,
    whatsappClicks: null,
    favorites: null,
    reviews: reviewCount,
    searchAppearances: 0,
    contactClicks: null,
    conversions: null,
  };

  try {
    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const since = weekAgo.toISOString();

    const admin = createAdminClient();

    const { data: logs, error: logsError } = await admin
      .from("search_logs")
      .select("provider_ids")
      .gte("created_at", since)
      .limit(3000);

    if (logsError) {
      console.error("[weekly-insights] search_logs:", logsError.message);
    }

    let searchAppearances = 0;
    for (const row of logs ?? []) {
      const ids = row.provider_ids as string[] | null;
      if (Array.isArray(ids) && ids.includes(providerId)) searchAppearances += 1;
    }

    const [profileViews, phoneClicks, whatsappClicks, favorites, impressions] =
      await Promise.all([
        countEvents(providerId, ["profile_view"], since),
        countEvents(providerId, ["contact_phone"], since),
        countEvents(providerId, ["contact_whatsapp"], since),
        countEvents(providerId, ["favorite"], since),
        countEvents(providerId, ["impression"], since),
      ]);

    const contactClicks = phoneClicks + whatsappClicks;

    return {
      profileViews: profileViews || null,
      phoneClicks: phoneClicks || null,
      whatsappClicks: whatsappClicks || null,
      favorites: favorites || null,
      reviews: reviewCount,
      searchAppearances: searchAppearances || impressions,
      contactClicks: contactClicks || null,
      conversions: contactClicks || null,
    };
  } catch (e) {
    console.error("[weekly-insights] unexpected:", e);
    return empty;
  }
}

export async function getLocationInsights(input: {
  providerId: string;
  cityId: string;
  locale: Locale;
  isPremium: boolean;
}): Promise<LocationInsights> {
  const empty: LocationInsights = {
    topVisitorArea: "—",
    averageCustomerDistanceKm: null,
    nearbySearchesThisWeek: 0,
    peakSearchDay: null,
    citySharePercent: null,
  };

  try {
    const admin = createAdminClient();
    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const providerCity = citySlugFromId(input.cityId);
    const useSnapshots = await hasRankingSnapshotColumn();

    const query = useSnapshots
      ? admin
          .from("search_logs")
          .select("provider_ids, city_slug, created_at, ranking_snapshot")
          .gte("created_at", weekAgo.toISOString())
          .limit(3000)
      : admin
          .from("search_logs")
          .select("provider_ids, city_slug, created_at")
          .gte("created_at", weekAgo.toISOString())
          .limit(3000);

    const { data: logs, error } = await query;

    if (error) {
      console.error("[location-insights]", error.message);
      return empty;
    }

    const cityCounts = new Map<string, number>();
    let nearbySearchesThisWeek = 0;
    const dayCounts = new Map<string, number>();
    const distances: number[] = [];

    for (const row of logs ?? []) {
      const ids = row.provider_ids as string[] | null;
      if (!Array.isArray(ids) || !ids.includes(input.providerId)) continue;

      const city = row.city_slug as string | null;
      if (city) {
        cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
        if (providerCity && city === providerCity) nearbySearchesThisWeek += 1;
      }

      if (input.isPremium && row.created_at) {
        const day = new Date(row.created_at as string).toLocaleDateString(input.locale, {
          weekday: "long",
        });
        dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      }

      if (useSnapshots) {
        const snap = (row as { ranking_snapshot?: unknown }).ranking_snapshot;
        if (Array.isArray(snap)) {
          const mine = snap.find(
            (s: { id?: string; distanceKm?: number | null }) => s?.id === input.providerId,
          );
          if (mine && typeof mine.distanceKm === "number" && Number.isFinite(mine.distanceKm)) {
            distances.push(mine.distanceKm);
          }
        }
      }
    }

    let topCity: string | null = null;
    let topCount = 0;
    let total = 0;
    for (const [city, count] of cityCounts) {
      total += count;
      if (count > topCount) {
        topCount = count;
        topCity = city;
      }
    }

    const districts = SAMPLE_DISTRICT_LABELS[input.locale === "ar" ? "ar" : "en"];
    const topVisitorArea = topCity
      ? topCity.charAt(0).toUpperCase() + topCity.slice(1)
      : nearbySearchesThisWeek > 0
        ? districts[0]
        : "—";

    const averageCustomerDistanceKm =
      distances.length > 0
        ? Math.round((distances.reduce((a, b) => a + b, 0) / distances.length) * 10) / 10
        : null;

    let peakSearchDay: string | null = null;
    if (input.isPremium && dayCounts.size > 0) {
      let best = 0;
      for (const [day, count] of dayCounts) {
        if (count > best) {
          best = count;
          peakSearchDay = day;
        }
      }
    }

    const citySharePercent =
      input.isPremium && total > 0 ? Math.round((topCount / total) * 100) : null;

    return {
      topVisitorArea,
      averageCustomerDistanceKm,
      nearbySearchesThisWeek,
      peakSearchDay,
      citySharePercent,
    };
  } catch (e) {
    console.error("[location-insights] unexpected:", e);
    return empty;
  }
}

export async function getProviderAnalyticsBundle(input: {
  providerId: string;
  categorySlug: string | null;
  cityId: string;
  locale: Locale;
  planSlug: PlanSlug;
  reviewCount: number;
}): Promise<ProviderAnalyticsBundle> {
  try {
    const isPremium = input.planSlug === "premium";
    const [weekly, growth, location] = await Promise.all([
      getWeeklyInsights(input.providerId, input.reviewCount),
      calculateGrowthPotential({
        providerId: input.providerId,
        categorySlug: input.categorySlug,
      }),
      getLocationInsights({
        providerId: input.providerId,
        cityId: input.cityId,
        locale: input.locale,
        isPremium,
      }),
    ]);

    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const since = weekAgo.toISOString();
    const [impressions, serpClicks] = await Promise.all([
      countEvents(input.providerId, ["impression"], since),
      countEvents(input.providerId, ["serp_click"], since),
    ]);

    return { weekly, growth, location, impressions, serpClicks };
  } catch (e) {
    console.error("[analytics-bundle] unexpected:", e);
    return {
      weekly: {
        profileViews: null,
        phoneClicks: null,
        whatsappClicks: null,
        favorites: null,
        reviews: input.reviewCount,
        searchAppearances: 0,
        contactClicks: null,
        conversions: null,
      },
      growth: {
        categorySearches: 0,
        currentAppearances: 0,
        proAppearances: 0,
        premiumAppearances: 0,
        snapshotsUsed: 0,
        unavailable: true,
      },
      location: {
        topVisitorArea: "—",
        averageCustomerDistanceKm: null,
        nearbySearchesThisWeek: 0,
        peakSearchDay: null,
        citySharePercent: null,
      },
      impressions: 0,
      serpClicks: 0,
    };
  }
}

export async function getLifetimeSearchAppearances(providerId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: logs } = await admin.from("search_logs").select("provider_ids").limit(5000);
  let count = 0;
  for (const row of logs ?? []) {
    const ids = row.provider_ids as string[] | null;
    if (Array.isArray(ids) && ids.includes(providerId)) count += 1;
  }
  return count;
}
