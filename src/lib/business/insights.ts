import { createAdminClient } from "@/lib/supabase/admin";

export type WeeklyInsights = {
  profileViews: number | null;
  phoneClicks: number | null;
  whatsappClicks: number | null;
  favorites: number | null;
  reviews: number;
  searchAppearances: number;
};

/**
 * Search appearances from search_logs; other engagement metrics stay null until event tracking ships.
 */
export async function getWeeklyInsights(
  providerId: string,
  reviewCount: number,
): Promise<WeeklyInsights> {
  const admin = createAdminClient();
  const weekAgo = new Date();
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

  const { data: logs } = await admin
    .from("search_logs")
    .select("provider_ids")
    .gte("created_at", weekAgo.toISOString())
    .limit(2000);

  let searchAppearances = 0;
  for (const row of logs ?? []) {
    const ids = row.provider_ids as string[] | null;
    if (Array.isArray(ids) && ids.includes(providerId)) {
      searchAppearances += 1;
    }
  }

  return {
    profileViews: null,
    phoneClicks: null,
    whatsappClicks: null,
    favorites: null,
    reviews: reviewCount,
    searchAppearances,
  };
}

export async function getLifetimeSearchAppearances(providerId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: logs } = await admin
    .from("search_logs")
    .select("provider_ids")
    .limit(5000);

  let count = 0;
  for (const row of logs ?? []) {
    const ids = row.provider_ids as string[] | null;
    if (Array.isArray(ids) && ids.includes(providerId)) count += 1;
  }
  return count;
}
