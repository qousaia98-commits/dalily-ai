import { createAdminClient } from "@/lib/supabase/admin";
import type { ProblemPriority } from "@/lib/search/engine/types";
import type { RankingSnapshotEntry } from "@/lib/search/ranking/ranking-engine";
import {
  hasRankingSnapshotColumn,
  isMissingColumnError,
} from "@/lib/search/schema-capabilities";
import type { Database } from "@/types/database.types";

export type SearchLogInsert = {
  queryText: string;
  normalizedQuery?: string | null;
  problemId?: string | null;
  categorySlug?: string | null;
  citySlug?: string | null;
  priority?: ProblemPriority | null;
  resultCount: number;
  providerIds: string[];
  nearbyRadius?: string | null;
  rankingSnapshot?: RankingSnapshotEntry[];
  userId?: string | null;
  locale?: string | null;
};

type SearchLogRow = Database["public"]["Tables"]["search_logs"]["Insert"];

export async function insertSearchLog(entry: SearchLogInsert): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const useSnapshots = await hasRankingSnapshotColumn();

    const base = {
      query_text: entry.queryText,
      normalized_query: entry.normalizedQuery ?? null,
      problem_id: entry.problemId ?? null,
      category_slug: entry.categorySlug ?? null,
      city_slug: entry.citySlug ?? null,
      priority: entry.priority ?? null,
      result_count: entry.resultCount,
      provider_ids: entry.providerIds,
      user_id: entry.userId ?? null,
      locale: entry.locale ?? null,
    };

    const row: SearchLogRow = useSnapshots
      ? {
          ...base,
          nearby_radius: entry.nearbyRadius ?? null,
          ranking_snapshot: (entry.rankingSnapshot ?? []) as SearchLogRow["ranking_snapshot"],
        }
      : base;

    const { data, error } = await admin.from("search_logs").insert(row).select("id").maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) {
        const { data: legacy, error: legacyError } = await admin
          .from("search_logs")
          .insert(base)
          .select("id")
          .maybeSingle();
        if (legacyError) {
          console.error("[search_logs] legacy insert failed:", legacyError.message);
          return null;
        }
        return legacy?.id ?? null;
      }
      console.error("[search_logs] insert failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("[search_logs] unexpected:", e);
    return null;
  }
}

export type EngagementEventType =
  | "impression"
  | "serp_click"
  | "profile_view"
  | "contact_phone"
  | "contact_whatsapp"
  | "favorite";

export async function insertEngagementEvent(input: {
  providerId: string;
  eventType: EngagementEventType;
  searchLogId?: string | null;
  position?: number | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("provider_engagement_events").insert({
      provider_id: input.providerId,
      event_type: input.eventType,
      search_log_id: input.searchLogId ?? null,
      position: input.position ?? null,
      user_id: input.userId ?? null,
      metadata: (input.metadata ??
        {}) as Database["public"]["Tables"]["provider_engagement_events"]["Insert"]["metadata"],
    });
    if (error) {
      console.error("[engagement] insert failed:", error.message);
    }
  } catch (e) {
    console.error("[engagement] unexpected:", e);
  }
}

export async function insertImpressionBatch(
  providerIds: string[],
  searchLogId: string | null,
): Promise<void> {
  if (providerIds.length === 0) return;
  try {
    const admin = createAdminClient();
    const rows = providerIds.map((providerId, index) => ({
      provider_id: providerId,
      event_type: "impression" as const,
      search_log_id: searchLogId,
      position: index + 1,
      metadata: {},
    }));
    const { error } = await admin.from("provider_engagement_events").insert(rows);
    if (error) console.error("[engagement] impressions failed:", error.message);
  } catch (e) {
    console.error("[engagement] impressions unexpected:", e);
  }
}
