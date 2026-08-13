"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getOwnedProvider } from "@/lib/providers/database";
import { providerRequestSettingsSchema } from "@/lib/validations/service-request";
import type { ServiceRequestActionState } from "./types";
import { validationError } from "./validation";

export async function saveProviderRequestSettingsAction(
  _prev: ServiceRequestActionState,
  formData: FormData,
): Promise<ServiceRequestActionState> {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const parsed = providerRequestSettingsSchema.safeParse({
    acceptingRequests: formData.get("acceptingRequests") === "on" || formData.get("acceptingRequests") === "true",
    maxPendingRequests: formData.get("maxPendingRequests"),
    autoRejectMessage: formData.get("autoRejectMessage") ?? "",
    vacationMode: formData.get("vacationMode") === "on" || formData.get("vacationMode") === "true",
    estimatedResponseHours: formData.get("estimatedResponseHours"),
    handlesEmergency:
      formData.get("handlesEmergency") === "on" ||
      formData.get("handlesEmergency") === "true",
  });
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("provider_request_settings").upsert({
    provider_id: provider.id,
    accepting_requests: parsed.data.acceptingRequests,
    max_pending_requests: parsed.data.maxPendingRequests,
    auto_reject_message: parsed.data.autoRejectMessage?.trim() || null,
    vacation_mode: parsed.data.vacationMode,
    estimated_response_hours: parsed.data.estimatedResponseHours,
    handles_emergency: parsed.data.handlesEmergency,
  });

  if (error) return { success: false, error: "settings_failed" };
  revalidatePath("/business/settings");
  revalidatePath("/business/account");
  return { success: true, message: "settings_saved" };
}
