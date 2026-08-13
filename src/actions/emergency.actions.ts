"use server";

import { revalidatePath } from "next/cache";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isEmergencyDispatchEnabled } from "@/lib/config/feature-flags";
import {
  activateEmergencyDispatch,
  recordEmergencyProviderResponse,
  updateEmergencyLiveLocation,
} from "@/lib/ai/dispatch/emergency";
import type { EmergencyProviderResponse } from "@/lib/ai/dispatch/emergency";

export type EmergencyActionResult =
  | { ok: true; dispatchStopped?: boolean }
  | { ok: false; error: string };

export async function activateEmergencyDispatchAction(
  serviceRequestId: string,
): Promise<EmergencyActionResult> {
  if (!isEmergencyDispatchEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const result = await activateEmergencyDispatch({
    serviceRequestId,
    customerId: user.id,
  });
  if (!result.dispatchId) return { ok: false, error: "activate_failed" };
  revalidatePath(`/request/${serviceRequestId}/waiting`);
  revalidatePath("/admin/emergency");
  return { ok: true };
}

export async function emergencyProviderRespondAction(input: {
  serviceRequestId: string;
  assignmentId?: string | null;
  response: EmergencyProviderResponse;
  etaMinutes?: number | null;
  note?: string | null;
}): Promise<EmergencyActionResult> {
  if (!isEmergencyDispatchEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { ok: false, error: "no_provider" };

  const result = await recordEmergencyProviderResponse({
    serviceRequestId: input.serviceRequestId,
    providerId: provider.id,
    assignmentId: input.assignmentId,
    response: input.response,
    etaMinutes: input.etaMinutes,
    note: input.note,
  });

  if (!result.ok) return { ok: false, error: "respond_failed" };

  revalidatePath(`/request/${input.serviceRequestId}/waiting`);
  revalidatePath("/business/opportunities");
  if (input.assignmentId) {
    revalidatePath(`/business/opportunities/${input.assignmentId}`);
  }
  revalidatePath("/admin/emergency");

  return { ok: true, dispatchStopped: result.dispatchStopped };
}

export async function shareEmergencyLiveLocationAction(input: {
  serviceRequestId: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracyM?: number | null;
  sharingEnabled?: boolean;
}): Promise<EmergencyActionResult> {
  if (!isEmergencyDispatchEnabled()) {
    return { ok: false, error: "feature_disabled" };
  }
  const user = await requireAuthUser();
  const provider = await getOwnedProvider(user.id);
  if (!provider) return { ok: false, error: "no_provider" };

  const ok = await updateEmergencyLiveLocation({
    serviceRequestId: input.serviceRequestId,
    providerId: provider.id,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyM: input.accuracyM,
    sharingEnabled: input.sharingEnabled,
  });

  if (!ok) return { ok: false, error: "location_failed" };
  revalidatePath(`/request/${input.serviceRequestId}/waiting`);
  return { ok: true };
}
