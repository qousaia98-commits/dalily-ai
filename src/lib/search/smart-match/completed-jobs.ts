import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Batch-count completed marketplace jobs for ranking enrichment.
 * Read-only aggregate via admin client (RLS would hide peer requests).
 * Does not alter request workflow.
 */
export async function fetchCompletedJobsByProviderIds(
  providerIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (providerIds.length === 0) return map;

  for (const id of providerIds) map.set(id, 0);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("service_requests")
      .select("provider_id")
      .in("provider_id", providerIds)
      .in("status", ["completed", "reviewed"]);

    if (error || !data) return map;

    for (const row of data) {
      const id = row.provider_id as string;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
  } catch {
    // Ranking continues with zeros — never fail search on enrichment.
  }

  return map;
}
