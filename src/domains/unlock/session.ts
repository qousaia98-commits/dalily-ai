import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isUnlockDevBypassEnabled,
  isUnlockV2Enabled,
} from "@/lib/config/feature-flags";
import { deliverMarketplaceNotification } from "@/lib/notifications/deliver";
import { syncMarketplaceRequestProjection } from "@/domains/marketplace/projection";
import {
  CONTACT_RELEASE_DEFAULT_SCOPE,
  getUnlockFeeSnapshot,
  getUnlockSlaHours,
  type UnlockSessionView,
} from "@/domains/unlock/types";

function mapSession(row: Record<string, unknown>): UnlockSessionView {
  return {
    id: row.id as string,
    selectionId: row.selection_id as string,
    serviceRequestId: row.service_request_id as string,
    providerId: row.provider_id as string,
    offerId: (row.offer_id as string) ?? null,
    status: row.status as UnlockSessionView["status"],
    feeAmount: Number(row.fee_amount),
    feeCurrency: row.fee_currency as string,
    slaDeadline: row.sla_deadline as string,
    fallbackApplied: Boolean(row.fallback_applied),
    openedAt: row.opened_at as string,
    closedAt: (row.closed_at as string) ?? null,
  };
}

/**
 * Open unlock session after customer selection.
 * Idempotent via idempotency_key = selection:<selectionId>.
 */
export async function openUnlockSessionForSelection(input: {
  selectionId: string;
}): Promise<{ ok: true; session: UnlockSessionView } | { ok: false; error: string }> {
  if (!isUnlockV2Enabled()) return { ok: false, error: "feature_disabled" };

  const admin = createAdminClient();
  const idempotencyKey = `selection:${input.selectionId}`;

  const { data: existing } = await admin
    .from("unlock_sessions")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) {
    return { ok: true, session: mapSession(existing as Record<string, unknown>) };
  }

  const { data: selection } = await admin
    .from("marketplace_selections")
    .select("id, service_request_id, provider_id, offer_id, status")
    .eq("id", input.selectionId)
    .maybeSingle();

  if (!selection) return { ok: false, error: "selection_not_found" };
  if (selection.status !== "pending_unlock") {
    return { ok: false, error: "selection_not_pending" };
  }
  if (!selection.provider_id) return { ok: false, error: "provider_required" };

  const fee = getUnlockFeeSnapshot();
  const slaHours = getUnlockSlaHours();
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: session, error } = await admin
    .from("unlock_sessions")
    .insert({
      selection_id: selection.id,
      service_request_id: selection.service_request_id,
      provider_id: selection.provider_id,
      offer_id: selection.offer_id,
      status: "payment_pending",
      fee_amount: fee.amount,
      fee_currency: fee.currency,
      sla_deadline: slaDeadline,
      fallback_applied: false,
      idempotency_key: idempotencyKey,
      payment_stub_ref: null,
      opened_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !session) {
    if (error?.code === "23505") {
      const { data: again } = await admin
        .from("unlock_sessions")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (again) return { ok: true, session: mapSession(again as Record<string, unknown>) };
    }
    return { ok: false, error: "session_failed" };
  }

  const { data: provider } = await admin
    .from("providers")
    .select("owner_id")
    .eq("id", selection.provider_id)
    .maybeSingle();

  if (provider?.owner_id) {
    await deliverMarketplaceNotification({
      userId: provider.owner_id as string,
      type: "unlock_opened",
      titleKey: "notifications.unlockOpened.title",
      bodyKey: "notifications.unlockOpened.body",
      href: `/business/unlock/${session.id}`,
      requestId: selection.service_request_id as string,
    });
  }

  return { ok: true, session: mapSession(session as Record<string, unknown>) };
}

export async function getUnlockSessionForSelection(
  selectionId: string,
): Promise<UnlockSessionView | null> {
  if (!isUnlockV2Enabled()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("unlock_sessions")
    .select("*")
    .eq("selection_id", selectionId)
    .maybeSingle();
  return data ? mapSession(data as Record<string, unknown>) : null;
}

export async function getUnlockSessionById(
  sessionId: string,
): Promise<UnlockSessionView | null> {
  if (!isUnlockV2Enabled()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("unlock_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  return data ? mapSession(data as Record<string, unknown>) : null;
}

export async function listProviderUnlockSessions(
  providerId: string,
): Promise<UnlockSessionView[]> {
  if (!isUnlockV2Enabled()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("unlock_sessions")
    .select("*")
    .eq("provider_id", providerId)
    .in("status", ["opened", "payment_pending", "succeeded", "declined", "timed_out"])
    .order("opened_at", { ascending: false })
    .limit(40);
  return (data ?? []).map((row) => mapSession(row as Record<string, unknown>));
}

/**
 * Fail-closed success path.
 * Grant only if UNLOCK_DEV_BYPASS or explicit audited confirm (admin/manual stub).
 */
export async function completeUnlockSuccess(input: {
  sessionId: string;
  actorUserId: string;
  mode: "dev_bypass" | "manual_confirm";
}): Promise<{ ok: true; grantId: string } | { ok: false; error: string }> {
  if (!isUnlockV2Enabled()) return { ok: false, error: "feature_disabled" };

  if (input.mode === "dev_bypass" && !isUnlockDevBypassEnabled()) {
    return { ok: false, error: "bypass_forbidden" };
  }

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("unlock_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!session) return { ok: false, error: "session_not_found" };
  if (session.status === "succeeded") {
    const { data: grant } = await admin
      .from("contact_release_grants")
      .select("id")
      .eq("unlock_session_id", session.id)
      .maybeSingle();
    if (grant) return { ok: true, grantId: grant.id as string };
  }
  if (!["opened", "payment_pending"].includes(session.status as string)) {
    return { ok: false, error: "invalid_status" };
  }

  const { data: request } = await admin
    .from("service_requests")
    .select("id, customer_id, status")
    .eq("id", session.service_request_id)
    .maybeSingle();
  if (!request) return { ok: false, error: "request_not_found" };

  const now = new Date().toISOString();

  const { data: grant, error: grantError } = await admin
    .from("contact_release_grants")
    .insert({
      unlock_session_id: session.id,
      service_request_id: session.service_request_id,
      provider_id: session.provider_id,
      customer_id: request.customer_id,
      scope: [...CONTACT_RELEASE_DEFAULT_SCOPE],
      granted_at: now,
    })
    .select("id")
    .single();

  if (grantError || !grant) {
    if (grantError?.code === "23505") {
      const { data: existingGrant } = await admin
        .from("contact_release_grants")
        .select("id")
        .eq("unlock_session_id", session.id)
        .maybeSingle();
      if (existingGrant) return { ok: true, grantId: existingGrant.id as string };
    }
    return { ok: false, error: "grant_failed" };
  }

  await admin
    .from("unlock_sessions")
    .update({
      status: "succeeded",
      payment_stub_ref:
        input.mode === "dev_bypass"
          ? `dev_bypass:${input.actorUserId}`
          : `manual_confirm:${input.actorUserId}`,
      updated_at: now,
      closed_at: now,
    })
    .eq("id", session.id);

  await admin
    .from("marketplace_selections")
    .update({ status: "unlocked", updated_at: now })
    .eq("id", session.selection_id);

  // Do NOT set service_requests.provider_id or open chat (Sprint 7 consumes grant).
  void syncMarketplaceRequestProjection({
    serviceRequestId: session.service_request_id as string,
    legacyStatus: (request.status as "pending") ?? "pending",
    lifecycleVersion: 2,
    selectionId: session.selection_id as string,
    phase: "unlocked",
  });

  await deliverMarketplaceNotification({
    userId: request.customer_id as string,
    type: "unlock_granted",
    titleKey: "notifications.unlockGranted.title",
    bodyKey: "notifications.unlockGranted.body",
    href: `/request/${session.service_request_id}/waiting`,
    requestId: session.service_request_id as string,
  });

  return { ok: true, grantId: grant.id as string };
}

export async function declineUnlockSession(input: {
  sessionId: string;
  providerId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isUnlockV2Enabled()) return { ok: false, error: "feature_disabled" };

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("unlock_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .eq("provider_id", input.providerId)
    .maybeSingle();

  if (!session) return { ok: false, error: "session_not_found" };
  if (!["opened", "payment_pending"].includes(session.status as string)) {
    return { ok: false, error: "invalid_status" };
  }

  const now = new Date().toISOString();
  await admin
    .from("unlock_sessions")
    .update({ status: "declined", updated_at: now, closed_at: now })
    .eq("id", session.id);

  await admin
    .from("marketplace_selections")
    .update({ status: "declined", updated_at: now })
    .eq("id", session.selection_id);

  await admin.from("unlock_reliability_signals").insert({
    unlock_session_id: session.id,
    provider_id: session.provider_id,
    signal_type: "declined",
  });

  const { applyUnlockFallback } = await import("@/domains/unlock/fallback");
  await applyUnlockFallback({ sessionId: session.id as string, reason: "declined" });

  return { ok: true };
}
