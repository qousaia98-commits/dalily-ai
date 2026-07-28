/**
 * Sprint 9 — Read-only marketplace inspection (match / offer / unlock).
 * Uses admin client for ops visibility; never returns contact PII.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminMigrationV2Enabled } from "@/lib/config/feature-flags";
import { getCellPolicy, buildCellKey } from "@/domains/admin/cell-policies";
import type { MatchReason } from "@/domains/matching";
import type { UnlockSessionView } from "@/domains/unlock/types";

export type MarketplaceInspection = {
  serviceRequestId: string;
  title: string;
  lifecycleVersion: number;
  status: string;
  cityId: string | null;
  categoryId: string | null;
  cellKey: string | null;
  cellPolicy: Awaited<ReturnType<typeof getCellPolicy>>;
  pool: {
    poolId: string;
    status: string;
    assignedCount: number;
    expandCount: number;
  } | null;
  assignments: Array<{
    providerId: string;
    rankInPool: number;
    source: string;
    reasons: MatchReason[];
    assignedAt: string;
  }>;
  offers: Array<{
    id: string;
    providerId: string;
    status: string;
    price: number | null;
    currency: string | null;
  }>;
  selection: {
    id: string;
    offerId: string | null;
    providerId: string | null;
    status: string;
  } | null;
  unlockSession: UnlockSessionView | null;
  hasGrant: boolean;
};

export async function inspectMarketplaceRequest(
  serviceRequestId: string,
): Promise<MarketplaceInspection | null> {
  if (!isAdminMigrationV2Enabled()) return null;

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("service_requests")
    .select("id, title, status, lifecycle_version, city_id, category_id")
    .eq("id", serviceRequestId)
    .maybeSingle();
  if (!request) return null;

  const cityId = (request.city_id as string) || null;
  const categoryId = (request.category_id as string) || null;
  const cellKey = cityId && categoryId ? buildCellKey(cityId, categoryId) : null;

  const [
    { data: pool },
    { data: assignmentRows },
    { data: offerRows },
    { data: selection },
    cellPolicy,
    { data: grant },
  ] = await Promise.all([
    admin
      .from("match_pools")
      .select("id, status, assigned_count, expand_count")
      .eq("service_request_id", serviceRequestId)
      .maybeSingle(),
    admin
      .from("match_assignments")
      .select("provider_id, rank_in_pool, source, reason_codes, assigned_at")
      .eq("service_request_id", serviceRequestId)
      .order("rank_in_pool", { ascending: true }),
    admin
      .from("marketplace_offers")
      .select("id, provider_id, status, price, currency")
      .eq("service_request_id", serviceRequestId)
      .order("created_at", { ascending: true }),
    admin
      .from("marketplace_selections")
      .select("id, offer_id, provider_id, status")
      .eq("service_request_id", serviceRequestId)
      .in("status", ["pending_unlock", "unlocked"])
      .maybeSingle(),
    cellKey ? getCellPolicy(cellKey) : Promise.resolve(null),
    admin
      .from("contact_release_grants")
      .select("id")
      .eq("service_request_id", serviceRequestId)
      .maybeSingle(),
  ]);

  let unlockSession: UnlockSessionView | null = null;
  if (selection?.id) {
    const { data: session } = await admin
      .from("unlock_sessions")
      .select("*")
      .eq("selection_id", selection.id)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (session) {
      unlockSession = {
        id: session.id as string,
        selectionId: session.selection_id as string,
        serviceRequestId: session.service_request_id as string,
        providerId: session.provider_id as string,
        offerId: (session.offer_id as string) ?? null,
        status: session.status as UnlockSessionView["status"],
        feeAmount: Number(session.fee_amount ?? 0),
        feeCurrency: (session.fee_currency as string) || "SYP",
        slaDeadline: session.sla_deadline as string,
        fallbackApplied: Boolean(session.fallback_applied),
        openedAt: session.opened_at as string,
        closedAt: (session.closed_at as string) ?? null,
      };
    }
  }

  return {
    serviceRequestId: request.id as string,
    title: (request.title as string) || "",
    lifecycleVersion: Number(request.lifecycle_version ?? 1),
    status: request.status as string,
    cityId,
    categoryId,
    cellKey,
    cellPolicy,
    pool: pool
      ? {
          poolId: pool.id as string,
          status: pool.status as string,
          assignedCount: Number(pool.assigned_count ?? 0),
          expandCount: Number(pool.expand_count ?? 0),
        }
      : null,
    assignments: (assignmentRows ?? []).map((a) => ({
      providerId: a.provider_id as string,
      rankInPool: Number(a.rank_in_pool ?? 0),
      source: a.source as string,
      reasons: (a.reason_codes as MatchReason[]) ?? [],
      assignedAt: a.assigned_at as string,
    })),
    offers: (offerRows ?? []).map((o) => ({
      id: o.id as string,
      providerId: o.provider_id as string,
      status: o.status as string,
      price: o.price != null ? Number(o.price) : null,
      currency: (o.currency as string) ?? null,
    })),
    selection: selection
      ? {
          id: selection.id as string,
          offerId: (selection.offer_id as string) ?? null,
          providerId: (selection.provider_id as string) ?? null,
          status: selection.status as string,
        }
      : null,
    unlockSession,
    hasGrant: Boolean(grant),
  };
}
