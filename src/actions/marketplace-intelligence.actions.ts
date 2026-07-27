"use server";

import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import { isAiMarketplaceIntelligenceEnabled } from "@/lib/config/feature-flags";
import {
  decideMarketplaceRecommendation,
  executeMarketplaceSimulation,
  setModuleEnabled,
  type IntelligenceModuleKey,
} from "@/lib/marketplace-intelligence";
import { createAdminClient } from "@/lib/supabase/admin";

export type MarketplaceIntelActionState = {
  success: boolean;
  error?: string;
};

function disabled(): MarketplaceIntelActionState {
  return { success: false, error: "feature_disabled" };
}

export async function runMarketplaceSimulationAction(input: {
  title: string;
  scenarioType: string;
  inputs?: Record<string, unknown>;
}): Promise<MarketplaceIntelActionState> {
  if (!isAiMarketplaceIntelligenceEnabled()) return disabled();
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  const result = await executeMarketplaceSimulation({
    title: input.title.trim() || "Custom simulation",
    scenarioType: input.scenarioType || "custom",
    inputs: input.inputs ?? {},
    createdBy: admin.id,
  });
  revalidatePath("/admin/marketplace-intelligence", "layout");
  return result ? { success: true } : { success: false, error: "simulation_failed" };
}

export async function decideMarketplaceRecommendationAction(input: {
  recommendationId: string;
  accept: boolean;
}): Promise<MarketplaceIntelActionState> {
  if (!isAiMarketplaceIntelligenceEnabled()) return disabled();
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  const ok = await decideMarketplaceRecommendation({
    recommendationId: input.recommendationId,
    accept: input.accept,
    decidedBy: admin.id,
  });
  revalidatePath("/admin/marketplace-intelligence", "layout");
  return ok ? { success: true } : { success: false, error: "update_failed" };
}

export async function setMarketplaceModuleAction(input: {
  moduleKey: IntelligenceModuleKey;
  enabled: boolean;
}): Promise<MarketplaceIntelActionState> {
  if (!isAiMarketplaceIntelligenceEnabled()) return disabled();
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  setModuleEnabled(input.moduleKey, input.enabled);
  try {
    const client = createAdminClient();
    await client
      .from("marketplace_algorithm_versions")
      .update({
        enabled: input.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("module_key", input.moduleKey)
      .eq("is_default", true);
  } catch {
    /* soft */
  }
  revalidatePath("/admin/marketplace-intelligence", "layout");
  return { success: true };
}

export async function setMarketplaceMlExperimentAction(input: {
  active: boolean;
}): Promise<MarketplaceIntelActionState> {
  if (!isAiMarketplaceIntelligenceEnabled()) return disabled();
  const admin = await requireAdminUser();
  if (!isAdminUser(admin.roles)) throw new Error("forbidden");
  setModuleEnabled("ml_ensemble", input.active);
  try {
    const client = createAdminClient();
    await client
      .from("marketplace_algorithm_versions")
      .update({
        enabled: input.active,
        updated_at: new Date().toISOString(),
      })
      .eq("module_key", "ml_ensemble");
  } catch {
    /* soft */
  }
  revalidatePath("/admin/marketplace-intelligence", "layout");
  return { success: true };
}
