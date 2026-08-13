"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isAiEngineV9Enabled } from "@/lib/config/feature-flags";
import {
  recordAutomationFeedback,
  reverseAutomationAction,
  upsertProviderAutomationSettings,
  getProviderAutomationSettings,
} from "@/lib/ai/automation";
import type { UserAutomationDecision } from "@/lib/ai/automation/types";

export async function respondToAutomationAction(input: {
  actionId: string;
  decision: UserAutomationDecision;
}): Promise<{ ok: boolean }> {
  if (!isAiEngineV9Enabled()) return { ok: false };
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false };

  const result = await recordAutomationFeedback({
    actionId: input.actionId,
    decision: input.decision,
  });

  revalidatePath("/", "layout");
  revalidatePath("/business");
  revalidatePath("/admin/ai-automation");
  return { ok: result.ok };
}

export async function reverseAutomationActionAction(
  actionId: string,
): Promise<{ ok: boolean }> {
  if (!isAiEngineV9Enabled()) return { ok: false };
  const authUser = await getAuthUser();
  if (!authUser) return { ok: false };

  const ok = await reverseAutomationAction(actionId);
  revalidatePath("/admin/ai-automation");
  revalidatePath("/business");
  return { ok };
}

export async function saveProviderAutomationSettingsAction(formData: FormData) {
  if (!isAiEngineV9Enabled()) {
    return { success: false as const, error: "disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false as const, error: "forbidden" };

  const current = await getProviderAutomationSettings(provider.id);
  const ok = await upsertProviderAutomationSettings({
    providerId: provider.id,
    autoAcceptEnabled:
      formData.get("autoAcceptEnabled") === "on" ||
      formData.get("autoAcceptEnabled") === "true",
    autoRejectOutOfArea:
      formData.get("autoRejectOutOfArea") === "on" ||
      formData.get("autoRejectOutOfArea") === "true",
    autoRejectOutsideHours:
      formData.get("autoRejectOutsideHours") === "on" ||
      formData.get("autoRejectOutsideHours") === "true",
    suggestRouteOptimization:
      formData.get("suggestRouteOptimization") === "on" ||
      formData.get("suggestRouteOptimization") === "true",
    suggestScheduleGaps:
      formData.get("suggestScheduleGaps") === "on" ||
      formData.get("suggestScheduleGaps") === "true",
    minAutoAcceptConfidence: current.minAutoAcceptConfidence,
  });

  revalidatePath("/business/settings");
  revalidatePath("/business/account");
  return ok
    ? { success: true as const }
    : { success: false as const, error: "settings_failed" };
}
