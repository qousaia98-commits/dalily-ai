import { logLearningEvent } from "@/lib/search/learning/repository";

/** Anonymous ranking analytics via existing learning_events pipeline. */
export async function trackRankingAnalytics(input: {
  event:
    | "ranking_applied"
    | "recommendation_badge_shown"
    | "search_result_ctr"
    | "conversion_by_rank";
  providerId?: string | null;
  customerId?: string | null;
  searchLogId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const typeMap = {
    ranking_applied: "recommendation_shown" as const,
    recommendation_badge_shown: "recommendation_shown" as const,
    search_result_ctr: "provider_clicked" as const,
    conversion_by_rank: "recommendation_chosen" as const,
  };

  await logLearningEvent({
    eventType: typeMap[input.event],
    providerId: input.providerId,
    customerId: input.customerId,
    searchLogId: input.searchLogId,
    metadata: {
      source: "dalily_ranking",
      rankingEvent: input.event,
      ...(input.metadata ?? {}),
    },
  });
}
