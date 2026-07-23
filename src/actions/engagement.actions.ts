"use server";

import { insertEngagementEvent } from "@/lib/search/repository/search-log.repository";
import { getAuthUser } from "@/lib/auth/session";
import { logLearningEvent } from "@/lib/search/learning";

export async function trackProviderEngagementAction(input: {
  providerId: string;
  eventType:
    | "serp_click"
    | "profile_view"
    | "contact_phone"
    | "contact_whatsapp"
    | "favorite";
  position?: number;
  searchLogId?: string;
}): Promise<{ success: boolean }> {
  if (!input.providerId || !input.eventType) return { success: false };
  const user = await getAuthUser();
  await insertEngagementEvent({
    providerId: input.providerId,
    eventType: input.eventType,
    position: input.position ?? null,
    searchLogId: input.searchLogId ?? null,
    userId: user?.id ?? null,
  });

  // Dual-write into Learning AI event stream (append-only)
  const learningType =
    input.eventType === "serp_click"
      ? ("provider_clicked" as const)
      : input.eventType === "profile_view"
        ? ("provider_viewed" as const)
        : null;

  if (learningType) {
    void logLearningEvent({
      eventType: learningType,
      providerId: input.providerId,
      customerId: user?.id ?? null,
      searchLogId: input.searchLogId ?? null,
      metadata: { position: input.position ?? null, source: input.eventType },
    });
  }

  if (input.eventType === "serp_click") {
    void logLearningEvent({
      eventType: "recommendation_chosen",
      providerId: input.providerId,
      customerId: user?.id ?? null,
      searchLogId: input.searchLogId ?? null,
      metadata: { position: input.position ?? null },
    });
  }

  return { success: true };
}
