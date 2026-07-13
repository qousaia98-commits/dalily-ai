import { createClient } from "@/lib/supabase/server";
import type { ProblemPriority } from "@/lib/search/engine/types";
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
  userId?: string | null;
  locale?: string | null;
};

type SearchLogRow = Database["public"]["Tables"]["search_logs"]["Insert"];

export async function insertSearchLog(entry: SearchLogInsert): Promise<void> {
  const supabase = await createClient();

  const row: SearchLogRow = {
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

  const { error } = await supabase.from("search_logs").insert(row);
  if (error) {
    console.error("[search_logs] insert failed:", error.message);
  }
}
