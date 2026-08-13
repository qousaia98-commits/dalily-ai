/**
 * Sprint 9 — Cell policy overrides (city × category).
 * Matching engine consults these when ADMIN_MIGRATION_V2 is on.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminMigrationV2Enabled } from "@/lib/config/feature-flags";
import { logAdminAction } from "@/lib/admin/action-log";

export type CellPolicyView = {
  cellKey: string;
  cityId: string | null;
  categoryId: string | null;
  frozen: boolean;
  limitedAvailability: boolean;
  concierge: boolean;
  note: string | null;
  updatedAt: string;
  updatedBy: string | null;
};

export function buildCellKey(cityId: string, categoryId: string): string {
  return `${cityId}:${categoryId}`;
}

export async function getCellPolicy(cellKey: string): Promise<CellPolicyView | null> {
  if (!isAdminMigrationV2Enabled()) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("cell_policies")
    .select("*")
    .eq("cell_key", cellKey)
    .maybeSingle();
  if (!data) return null;
  return mapPolicy(data as Record<string, unknown>);
}

export async function listCellPolicies(limit = 100): Promise<CellPolicyView[]> {
  if (!isAdminMigrationV2Enabled()) return [];
  const admin = createAdminClient();
  const { data } = await admin
    .from("cell_policies")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => mapPolicy(row as Record<string, unknown>));
}

/**
 * Upsert cell policy. Idempotent for same flags. Requires audit reason.
 */
export async function upsertCellPolicy(input: {
  actorId: string;
  cityId: string;
  categoryId: string;
  frozen: boolean;
  limitedAvailability: boolean;
  concierge: boolean;
  note?: string | null;
  reason: string;
}): Promise<{ ok: true; policy: CellPolicyView } | { ok: false; error: string }> {
  if (!isAdminMigrationV2Enabled()) return { ok: false, error: "feature_disabled" };
  const reason = input.reason.trim();
  if (reason.length < 5) return { ok: false, error: "reason_required" };
  if (!input.cityId || !input.categoryId) return { ok: false, error: "cell_required" };

  const cellKey = buildCellKey(input.cityId, input.categoryId);
  const now = new Date().toISOString();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("cell_policies")
    .upsert(
      {
        cell_key: cellKey,
        city_id: input.cityId,
        category_id: input.categoryId,
        frozen: input.frozen,
        limited_availability: input.limitedAvailability,
        concierge: input.concierge,
        note: input.note?.trim() || null,
        updated_by: input.actorId,
        updated_at: now,
      },
      { onConflict: "cell_key" },
    )
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "upsert_failed" };

  await logAdminAction({
    actorId: input.actorId,
    action: input.frozen ? "cell_frozen" : "cell_policy_updated",
    entityType: "cell_policy",
    entityId: cellKey,
    metadata: {
      cityId: input.cityId,
      categoryId: input.categoryId,
      frozen: input.frozen,
      limitedAvailability: input.limitedAvailability,
      concierge: input.concierge,
      reason,
    },
  });

  return { ok: true, policy: mapPolicy(data as Record<string, unknown>) };
}

function mapPolicy(row: Record<string, unknown>): CellPolicyView {
  return {
    cellKey: row.cell_key as string,
    cityId: (row.city_id as string) ?? null,
    categoryId: (row.category_id as string) ?? null,
    frozen: Boolean(row.frozen),
    limitedAvailability: Boolean(row.limited_availability),
    concierge: Boolean(row.concierge),
    note: (row.note as string) ?? null,
    updatedAt: row.updated_at as string,
    updatedBy: (row.updated_by as string) ?? null,
  };
}
