/**
 * Sprint 6 Phase 1 — admin billing settings + audit.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { MonetizationBillingSettings } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

const DEFAULTS: Omit<MonetizationBillingSettings, "id"> = {
  businessPriceUsd: 20,
  includedUnlocks: 10,
  minLeadPriceUsd: 2,
  maxLeadPriceUsd: 20,
  baseLeadPriceUsd: 5,
  emergencyMultiplier: 1.5,
  urgencyMultiplier: 1.25,
  multiServiceMultiplier: 1.35,
  complexityMultiplier: 1.2,
  distanceMultiplierPerKm: 0.02,
  demandMultiplier: 1.1,
  categoryMultipliers: {},
  currency: "USD",
};

function mapSettings(row: Record<string, unknown>): MonetizationBillingSettings {
  return {
    id: String(row.id),
    businessPriceUsd: Number(row.business_price_usd ?? 20),
    includedUnlocks: Number(row.included_unlocks ?? 10),
    minLeadPriceUsd: Number(row.min_lead_price_usd ?? 2),
    maxLeadPriceUsd: Number(row.max_lead_price_usd ?? 20),
    baseLeadPriceUsd: Number(row.base_lead_price_usd ?? 5),
    emergencyMultiplier: Number(row.emergency_multiplier ?? 1.5),
    urgencyMultiplier: Number(row.urgency_multiplier ?? 1.25),
    multiServiceMultiplier: Number(row.multi_service_multiplier ?? 1.35),
    complexityMultiplier: Number(row.complexity_multiplier ?? 1.2),
    distanceMultiplierPerKm: Number(row.distance_multiplier_per_km ?? 0.02),
    demandMultiplier: Number(row.demand_multiplier ?? 1.1),
    categoryMultipliers:
      (row.category_multipliers as Record<string, number>) ?? {},
    currency: String(row.currency ?? "USD"),
  };
}

export async function getBillingSettings(): Promise<MonetizationBillingSettings> {
  try {
    const { data } = await db()
      .from("monetization_billing_settings")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return { id: "default", ...DEFAULTS };
    return mapSettings(data);
  } catch {
    return { id: "default", ...DEFAULTS };
  }
}

export async function updateBillingSettings(
  patch: Partial<Omit<MonetizationBillingSettings, "id">>,
  actorUserId?: string | null,
): Promise<MonetizationBillingSettings> {
  const current = await getBillingSettings();
  const next = { ...current, ...patch };
  const min = Math.max(0.01, next.minLeadPriceUsd);
  const max = Math.max(min, next.maxLeadPriceUsd);

  const row = {
    business_price_usd: next.businessPriceUsd,
    included_unlocks: Math.max(0, Math.floor(next.includedUnlocks)),
    min_lead_price_usd: min,
    max_lead_price_usd: max,
    base_lead_price_usd: next.baseLeadPriceUsd,
    emergency_multiplier: next.emergencyMultiplier,
    urgency_multiplier: next.urgencyMultiplier,
    multi_service_multiplier: next.multiServiceMultiplier,
    complexity_multiplier: next.complexityMultiplier,
    distance_multiplier_per_km: next.distanceMultiplierPerKm,
    demand_multiplier: next.demandMultiplier,
    category_multipliers: next.categoryMultipliers,
    currency: next.currency || "USD",
    updated_by: actorUserId ?? null,
    updated_at: new Date().toISOString(),
    is_active: true,
  };

  if (current.id !== "default") {
    await db()
      .from("monetization_billing_settings")
      .update(row)
      .eq("id", current.id);
    return { ...next, id: current.id, minLeadPriceUsd: min, maxLeadPriceUsd: max };
  }

  const { data } = await db()
    .from("monetization_billing_settings")
    .insert(row)
    .select("*")
    .single();
  return data
    ? mapSettings(data)
    : {
        ...next,
        id: "default",
        minLeadPriceUsd: min,
        maxLeadPriceUsd: max,
      };
}

export async function writeMonetizationAudit(input: {
  eventKey: string;
  actorUserId?: string | null;
  providerId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db().from("monetization_audit_logs").insert({
      event_key: input.eventKey,
      actor_user_id: input.actorUserId ?? null,
      provider_id: input.providerId ?? null,
      payload: input.payload ?? {},
    });
  } catch {
    // soft
  }
}
