"use server";

import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProvider } from "@/lib/providers/database";
import { logLearningEvent, scheduleLearningUpdate } from "@/lib/search/learning";
import { revalidateAfterMarketplaceWrite } from "./shared";
import type { ServiceRequestActionState } from "./types";

/** Provider reject of a pending request (legacy cancel-equivalent on this surface). */
export async function rejectServiceRequestAction(
  requestId: string,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_service_request", {
    p_request_id: requestId,
    p_actor_id: authUser.id,
  });

  if (error) {
    if (error.message.includes("request_not_pending")) return { success: false, error: "not_pending" };
    return { success: false, error: "reject_failed" };
  }

  revalidateAfterMarketplaceWrite(requestId, "rejected");
  void logLearningEvent({
    eventType: "request_declined",
    providerId: provider.id,
    serviceRequestId: requestId,
    customerId: authUser.id,
  });
  scheduleLearningUpdate({ providerId: provider.id });
  return { success: true, message: "rejected" };
}
