"use server";

import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProvider } from "@/lib/providers/database";
import { logLearningEvent, scheduleLearningUpdate } from "@/lib/search/learning";
import { revalidateAfterMarketplaceWrite } from "./shared";
import type { ServiceRequestActionState } from "./types";

export async function acceptServiceRequestAction(
  requestId: string,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_service_request", {
    p_request_id: requestId,
    p_actor_id: authUser.id,
  });

  if (error) {
    if (error.message.includes("request_not_pending")) return { success: false, error: "not_pending" };
    if (error.message.includes("forbidden")) return { success: false, error: "forbidden" };
    return { success: false, error: "accept_failed" };
  }

  revalidateAfterMarketplaceWrite(requestId, "accepted");
  void logLearningEvent({
    eventType: "request_accepted",
    providerId: provider.id,
    serviceRequestId: requestId,
    customerId: authUser.id,
  });
  scheduleLearningUpdate({ providerId: provider.id });
  return { success: true, message: "accepted", conversationId: data as string };
}
