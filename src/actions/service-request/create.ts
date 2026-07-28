"use server";

import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getProviderRequestSettings,
  hasPendingRequest,
} from "@/lib/service-requests/queries";
import { createServiceRequestSchema } from "@/lib/validations/service-request";
import { logLearningEvent, scheduleLearningUpdate } from "@/lib/search/learning";
import { uploadServiceRequestPhotos } from "./attachments";
import { revalidateAfterMarketplaceWrite } from "./shared";
import type { ServiceRequestActionState } from "./types";
import { validationError } from "./validation";

export async function createServiceRequestAction(
  _prev: ServiceRequestActionState,
  formData: FormData,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const parsed = createServiceRequestSchema.safeParse({
    providerId: formData.get("providerId"),
    title: formData.get("title"),
    description: formData.get("description"),
    preferredDate: formData.get("preferredDate") ?? "",
    preferredTime: formData.get("preferredTime") ?? "",
    budget: formData.get("budget") ?? "",
    locationText: formData.get("locationText") ?? "",
  });

  if (!parsed.success) return validationError(parsed.error);

  const settings = await getProviderRequestSettings(parsed.data.providerId);
  if (!settings.accepting_requests || settings.vacation_mode) {
    return { success: false, error: "not_accepting" };
  }

  const pending = await hasPendingRequest(authUser.id, parsed.data.providerId);
  if (pending) return { success: false, error: "pending_exists" };

  const supabase = await createClient();
  const { count: pendingCount } = await supabase
    .from("service_requests")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", parsed.data.providerId)
    .eq("status", "pending");

  if ((pendingCount ?? 0) >= settings.max_pending_requests) {
    return { success: false, error: "provider_at_capacity" };
  }

  const budgetRaw = parsed.data.budget?.trim();
  const budget =
    budgetRaw && budgetRaw.length > 0 && !Number.isNaN(Number(budgetRaw))
      ? Number(budgetRaw)
      : null;

  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("id, status, owner_id")
    .eq("id", parsed.data.providerId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (providerError || !provider) return { success: false, error: "provider_not_found" };
  if (provider.owner_id === authUser.id) {
    return { success: false, error: "self_request" };
  }

  const { data: request, error: insertError } = await supabase
    .from("service_requests")
    .insert({
      customer_id: authUser.id,
      provider_id: parsed.data.providerId,
      title: parsed.data.title,
      description: parsed.data.description,
      preferred_date: parsed.data.preferredDate?.trim() || null,
      preferred_time: parsed.data.preferredTime?.trim() || null,
      budget,
      location_text: parsed.data.locationText?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !request) {
    if (insertError?.code === "23505") return { success: false, error: "pending_exists" };
    return { success: false, error: "create_failed" };
  }

  await uploadServiceRequestPhotos({
    supabase,
    formData,
    customerId: authUser.id,
    requestId: request.id,
  });

  if (provider.owner_id) {
    await supabase.rpc("notify_marketplace_user", {
      p_user_id: provider.owner_id,
      p_type: "new_request",
      p_title_key: "notifications.newRequest.title",
      p_body_key: "notifications.newRequest.body",
      p_body_params: { title: parsed.data.title },
      p_href: `/business/requests/${request.id}`,
      p_request_id: request.id,
      p_conversation_id: null,
    });
  }

  revalidateAfterMarketplaceWrite(request.id, "pending");
  void logLearningEvent({
    eventType: "request_sent",
    providerId: provider.id,
    customerId: authUser.id,
    serviceRequestId: request.id,
  });
  // Repeat booking signal when customer had a prior completed job with this provider
  void (async () => {
    try {
      const { count } = await supabase
        .from("service_requests")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", authUser.id)
        .eq("provider_id", provider.id)
        .in("status", ["completed", "reviewed"])
        .neq("id", request.id);
      if ((count ?? 0) > 0) {
        await logLearningEvent({
          eventType: "repeat_booking",
          providerId: provider.id,
          customerId: authUser.id,
          serviceRequestId: request.id,
        });
      }
    } catch {
      // non-blocking
    }
  })();
  scheduleLearningUpdate({ providerId: provider.id, customerId: authUser.id });
  return { success: true, message: "request_sent", requestId: request.id };
}
