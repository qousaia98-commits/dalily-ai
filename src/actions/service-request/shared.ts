import { createClient } from "@/lib/supabase/server";
import type { ServiceRequestStatus } from "@/lib/service-requests/status-machine";
import { revalidateOrderSurfaces } from "@/lib/orders/revalidate";
import { afterLegacyMarketplaceWrite } from "@/domains/marketplace/repository";

/** Thin Sprint 1 adapter: legacy write path + optional Marketplace projection sync (flag-gated). */
export function revalidateAfterMarketplaceWrite(
  requestId: string,
  legacyStatus: ServiceRequestStatus,
) {
  revalidateOrderSurfaces(requestId);
  void afterLegacyMarketplaceWrite(requestId, legacyStatus);
}

export async function postSystemAndNotify(input: {
  requestId: string;
  actorId: string;
  conversationId: string | null;
  body: string;
  eventType: string;
  notifyUserId: string;
  notifyType: string;
  titleKey: string;
  bodyKey: string;
  href: string;
  params?: Record<string, string | number>;
}) {
  const supabase = await createClient();
  if (input.conversationId) {
    await supabase.rpc("post_system_message", {
      p_conversation_id: input.conversationId,
      p_actor_id: input.actorId,
      p_body: input.body,
      p_event_type: input.eventType,
    });
  }
  await supabase.rpc("notify_marketplace_user", {
    p_user_id: input.notifyUserId,
    p_type: input.notifyType,
    p_title_key: input.titleKey,
    p_body_key: input.bodyKey,
    p_body_params: input.params ?? {},
    p_href: input.href,
    p_request_id: input.requestId,
    p_conversation_id: input.conversationId,
  });
}
