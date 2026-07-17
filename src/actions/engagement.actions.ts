"use server";

import { insertEngagementEvent } from "@/lib/search/repository/search-log.repository";
import { getAuthUser } from "@/lib/auth/session";

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
  return { success: true };
}
