import { createAdminClient } from "@/lib/supabase/admin";
import { deliverMarketplaceNotificationsBatch } from "@/lib/notifications/deliver";
import { findEligibleProviderCandidates } from "@/domains/matching/eligibility";
import { selectAssignmentsFromCandidates } from "@/domains/matching/rank";
import { MATCHING_POLICY, type MatchingPolicySnapshot } from "@/domains/matching/policy";
import {
  isAiEngineV2Enabled,
  isAiEngineV3Enabled,
  isMatchingV2Enabled,
} from "@/lib/config/feature-flags";
import { logger } from "@/lib/observability/logger";
import type { RankedAssignment } from "@/domains/matching/rank";
import type { AiRankedAssignment } from "@/lib/ai/matching/rank-with-ai";
import type { DispatchRankedAssignment } from "@/lib/ai/dispatch/select";

export type MatchRunResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  poolId?: string;
  assignedCount: number;
  expandCount: number;
  status: string;
};

function policySnapshot(): MatchingPolicySnapshot {
  return {
    initialMaxAssignments: MATCHING_POLICY.initialMaxAssignments,
    expandedMaxAssignments: MATCHING_POLICY.expandedMaxAssignments,
    minDesiredAssignments: MATCHING_POLICY.minDesiredAssignments,
    newcomerMax: MATCHING_POLICY.newcomerMax,
    subscriptionInfluence: false,
  };
}

async function resolveCategorySlug(categoryId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .maybeSingle();
    return (data?.slug as string | undefined) ?? null;
  } catch {
    return null;
  }
}

async function selectForRequest(
  candidates: Awaited<ReturnType<typeof findEligibleProviderCandidates>>,
  opts: {
    urgency: "emergency" | "normal";
    max: number;
    source: "initial" | "expand";
    alreadyAssignedIds?: Set<string>;
    categoryId: string;
    serviceRequestId: string;
    cityId?: string | null;
    expandArea?: boolean;
  },
): Promise<Array<RankedAssignment | AiRankedAssignment | DispatchRankedAssignment>> {
  const categorySlug = await resolveCategorySlug(opts.categoryId);

  if (isAiEngineV3Enabled()) {
    const { selectAssignmentsWithSmartDispatch } = await import(
      "@/lib/ai/dispatch/select"
    );
    return selectAssignmentsWithSmartDispatch(candidates, {
      urgency: opts.urgency,
      aiUrgency: opts.urgency === "emergency" ? "high" : "medium",
      max: opts.max,
      source: opts.source,
      alreadyAssignedIds: opts.alreadyAssignedIds,
      categorySlug,
      serviceRequestId: opts.serviceRequestId,
      cityId: opts.cityId,
      expandArea: opts.expandArea,
    });
  }

  if (!isAiEngineV2Enabled()) {
    return selectAssignmentsFromCandidates(candidates, {
      urgency: opts.urgency,
      max: opts.max,
      source: opts.source,
      alreadyAssignedIds: opts.alreadyAssignedIds,
    });
  }

  const { selectAssignmentsWithAiRanking } = await import(
    "@/lib/ai/matching/rank-with-ai"
  );
  return selectAssignmentsWithAiRanking(candidates, {
    urgency: opts.urgency,
    aiUrgency: opts.urgency === "emergency" ? "high" : "medium",
    max: opts.max,
    source: opts.source,
    alreadyAssignedIds: opts.alreadyAssignedIds,
    categorySlug,
    serviceRequestId: opts.serviceRequestId,
  });
}

function assignmentInsertRows(
  poolId: string,
  requestId: string,
  selected: Array<RankedAssignment | AiRankedAssignment | DispatchRankedAssignment>,
  rankOffset = 0,
) {
  return selected.map((a) => {
    const ai = a as AiRankedAssignment;
    const dispatch = a as DispatchRankedAssignment;
    return {
      pool_id: poolId,
      service_request_id: requestId,
      provider_id: a.providerId,
      reason_codes: a.reasons,
      rank_in_pool: rankOffset + a.rank,
      source:
        a.source === "newcomer"
          ? "newcomer"
          : a.source === "expand"
            ? "expand"
            : "initial",
      ai_match_score:
        typeof ai.aiMatchScore === "number" ? ai.aiMatchScore : null,
      ai_explanation: ai.aiExplanation ?? [],
      exposure_mode: dispatch.exposureMode ?? null,
      response_band: dispatch.responseBand ?? null,
      response_probability:
        typeof dispatch.responseProbability === "number"
          ? dispatch.responseProbability
          : null,
      eta_label: dispatch.etaLabel ?? null,
      operational_score:
        typeof dispatch.operationalScore === "number"
          ? dispatch.operationalScore
          : null,
      reputation_score:
        typeof dispatch.reputationScore === "number"
          ? dispatch.reputationScore
          : null,
    };
  });
}

async function loadRequestForMatching(requestId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("service_requests")
    .select(
      "id, customer_id, category_id, city_id, urgency, lifecycle_version, provider_id, status",
    )
    .eq("id", requestId)
    .maybeSingle();
  return data;
}

async function notifyAssignees(
  requestId: string,
  ownerIds: string[],
): Promise<void> {
  if (ownerIds.length === 0) return;
  const diagnostics = await deliverMarketplaceNotificationsBatch(
    [...new Set(ownerIds)],
    {
      type: "match_assignment",
      titleKey: "notifications.matchAssignment.title",
      bodyKey: "notifications.matchAssignment.body",
      bodyParams: {},
      href: "/business/opportunities",
      requestId,
    },
    { max: MATCHING_POLICY.expandedMaxAssignments },
  );
  if (diagnostics.deliveryFailures > 0) {
    logger.warn("matching.engine", "match assignment notification delivery failures", {
      requestId,
      deliveryFailures: diagnostics.deliveryFailures,
      failedUserIds: diagnostics.failedUserIds,
    });
  }
}

/**
 * Create or refresh the match pool for a marketplace-native request.
 * Idempotent per request: existing pool is expanded via expandMatchPool instead of duplicated.
 */
export async function runMatchingForRequest(requestId: string): Promise<MatchRunResult> {
  if (!isMatchingV2Enabled()) {
    return { ok: true, skipped: true, reason: "flag_off", assignedCount: 0, expandCount: 0, status: "skipped" };
  }

  const request = await loadRequestForMatching(requestId);
  if (!request) {
    return { ok: false, reason: "request_not_found", assignedCount: 0, expandCount: 0, status: "error" };
  }
  if ((request.lifecycle_version ?? 1) < 2 || request.provider_id) {
    return { ok: true, skipped: true, reason: "not_marketplace_native", assignedCount: 0, expandCount: 0, status: "skipped" };
  }
  if (!request.category_id || !request.city_id) {
    return { ok: false, reason: "missing_category_or_city", assignedCount: 0, expandCount: 0, status: "error" };
  }

  const admin = createAdminClient();
  const { data: existingPool } = await admin
    .from("match_pools")
    .select("id, expand_count, assigned_count, status")
    .eq("service_request_id", requestId)
    .maybeSingle();

  if (existingPool) {
    return expandMatchPool(requestId);
  }

  const urgency = request.urgency === "emergency" ? "emergency" : "normal";
  const cellKey = `${request.city_id}:${request.category_id}`;

  // Sprint 9 — cell freeze / limited availability (when ADMIN_MIGRATION_V2 on)
  const { isAdminMigrationV2Enabled } = await import("@/lib/config/feature-flags");
  let limitedMax: number | null = null;
  if (isAdminMigrationV2Enabled()) {
    const { getCellPolicy } = await import("@/domains/admin/cell-policies");
    const policy = await getCellPolicy(cellKey);
    if (policy?.frozen) {
      return {
        ok: true,
        skipped: true,
        reason: "cell_frozen",
        assignedCount: 0,
        expandCount: 0,
        status: "cell_frozen",
      };
    }
    if (policy?.limitedAvailability) {
      limitedMax = Math.min(MATCHING_POLICY.initialMaxAssignments, 3);
    }
  }

  const candidates = await findEligibleProviderCandidates({
    categoryId: request.category_id,
    cityId: request.city_id,
    urgency,
    expandArea: false,
  });

  const selected = await selectForRequest(candidates, {
    urgency,
    max: limitedMax ?? MATCHING_POLICY.initialMaxAssignments,
    source: "initial",
    categoryId: request.category_id,
    serviceRequestId: requestId,
    cityId: request.city_id,
    expandArea: false,
  });

  const status =
    selected.length === 0
      ? "insufficient_supply"
      : selected.length < MATCHING_POLICY.minDesiredAssignments
        ? "open"
        : "open";

  const { data: pool, error: poolError } = await admin
    .from("match_pools")
    .insert({
      service_request_id: requestId,
      cell_key: cellKey,
      status,
      expand_count: 0,
      initial_candidate_count: candidates.length,
      assigned_count: selected.length,
      policy_snapshot: policySnapshot(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (poolError || !pool) {
    return { ok: false, reason: poolError?.message ?? "pool_insert_failed", assignedCount: 0, expandCount: 0, status: "error" };
  }

  if (selected.length > 0) {
    const { error: assignError } = await admin.from("match_assignments").insert(
      assignmentInsertRows(pool.id, requestId, selected),
    );
    if (assignError) {
      return { ok: false, reason: assignError.message, assignedCount: 0, expandCount: 0, status: "error" };
    }
    await notifyAssignees(
      requestId,
      selected.map((a) => a.ownerId),
    );
  }

  let expandCount = 0;
  let assignedCount = selected.length;
  let finalStatus = status;

  if (assignedCount < MATCHING_POLICY.minDesiredAssignments) {
    const expanded = await expandMatchPool(requestId);
    expandCount = expanded.expandCount;
    assignedCount = expanded.assignedCount;
    finalStatus = expanded.status;
  }

  return {
    ok: true,
    poolId: pool.id,
    assignedCount,
    expandCount,
    status: finalStatus,
  };
}

/**
 * Expand-on-failure: widen area (drop city hard gate) and fill up to expandedMax.
 * Testable independently of publish.
 */
export async function expandMatchPool(requestId: string): Promise<MatchRunResult> {
  if (!isMatchingV2Enabled()) {
    return { ok: true, skipped: true, reason: "flag_off", assignedCount: 0, expandCount: 0, status: "skipped" };
  }

  const request = await loadRequestForMatching(requestId);
  if (!request?.category_id || !request.city_id) {
    return { ok: false, reason: "request_not_found", assignedCount: 0, expandCount: 0, status: "error" };
  }

  const admin = createAdminClient();
  const cellKey = `${request.city_id}:${request.category_id}`;
  const { isAdminMigrationV2Enabled } = await import("@/lib/config/feature-flags");
  if (isAdminMigrationV2Enabled()) {
    const { getCellPolicy } = await import("@/domains/admin/cell-policies");
    const policy = await getCellPolicy(cellKey);
    if (policy?.frozen) {
      return {
        ok: true,
        skipped: true,
        reason: "cell_frozen",
        assignedCount: 0,
        expandCount: 0,
        status: "cell_frozen",
      };
    }
  }

  const { data: pool } = await admin
    .from("match_pools")
    .select("id, expand_count, assigned_count, status")
    .eq("service_request_id", requestId)
    .maybeSingle();

  if (!pool) {
    return { ok: false, reason: "pool_missing", assignedCount: 0, expandCount: 0, status: "error" };
  }

  const { data: existing } = await admin
    .from("match_assignments")
    .select("provider_id")
    .eq("service_request_id", requestId);

  const already = new Set((existing ?? []).map((r) => r.provider_id as string));
  const urgency = request.urgency === "emergency" ? "emergency" : "normal";

  // Stop expanding outreach once emergency dispatch has enough accepts.
  if (urgency === "emergency") {
    try {
      const { isEmergencyDispatchEnabled } = await import(
        "@/lib/config/feature-flags"
      );
      if (isEmergencyDispatchEnabled()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ed } = await (admin as any)
          .from("emergency_dispatches")
          .select("stopped_at, accepted_count, target_accepts")
          .eq("service_request_id", requestId)
          .maybeSingle();
        if (
          ed?.stopped_at ||
          (Number(ed?.accepted_count ?? 0) >=
            Number(ed?.target_accepts ?? 1) &&
            Number(ed?.accepted_count ?? 0) > 0)
        ) {
          return {
            ok: true,
            skipped: true,
            reason: "emergency_dispatch_stopped",
            assignedCount: already.size,
            expandCount: Number(pool.expand_count ?? 0),
            status: "filled",
          };
        }
      }
    } catch {
      /* soft */
    }
  }

  const candidates = await findEligibleProviderCandidates({
    categoryId: request.category_id,
    cityId: request.city_id,
    urgency,
    expandArea: true,
  });

  const room = Math.max(0, MATCHING_POLICY.expandedMaxAssignments - already.size);
  const selected = await selectForRequest(candidates, {
    urgency,
    max: room,
    source: "expand",
    alreadyAssignedIds: already,
    categoryId: request.category_id,
    serviceRequestId: requestId,
    cityId: request.city_id,
    expandArea: true,
  });

  if (selected.length > 0) {
    await admin.from("match_assignments").insert(
      assignmentInsertRows(pool.id, requestId, selected, already.size).map((row) => ({
        ...row,
        source: row.source === "newcomer" ? "newcomer" : "expand",
      })),
    );
    await notifyAssignees(
      requestId,
      selected.map((a) => a.ownerId),
    );
  }

  const assignedCount = already.size + selected.length;
  const expandCount = Number(pool.expand_count ?? 0) + 1;
  const status =
    assignedCount === 0
      ? "insufficient_supply"
      : "expanded";

  await admin
    .from("match_pools")
    .update({
      expand_count: expandCount,
      assigned_count: assignedCount,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pool.id);

  return {
    ok: true,
    poolId: pool.id,
    assignedCount,
    expandCount,
    status,
  };
}
