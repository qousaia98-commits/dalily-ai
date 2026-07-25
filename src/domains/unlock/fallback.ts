import { createAdminClient } from "@/lib/supabase/admin";
import { isUnlockV2Enabled } from "@/lib/config/feature-flags";
import { openUnlockSessionForSelection } from "@/domains/unlock/session";
import { syncMarketplaceRequestProjection } from "@/domains/marketplace/projection";
import { deliverMarketplaceNotification } from "@/lib/notifications/deliver";

/**
 * Idempotent fallback: at most once per unlock session.
 * Picks next superseded offer for the request (runner-up) when available.
 */
export async function applyUnlockFallback(input: {
  sessionId: string;
  reason: "declined" | "timed_out";
}): Promise<{ ok: true; fallbackSelectionId?: string } | { ok: false; error: string }> {
  if (!isUnlockV2Enabled()) return { ok: false, error: "feature_disabled" };

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("unlock_sessions")
    .select("*")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!session) return { ok: false, error: "session_not_found" };
  if (session.fallback_applied) {
    return { ok: true };
  }

  // Claim fallback slot first (idempotent under race).
  const { data: claimed, error: claimError } = await admin
    .from("unlock_sessions")
    .update({
      fallback_applied: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("fallback_applied", false)
    .select("id")
    .maybeSingle();

  if (claimError) return { ok: false, error: claimError.message };
  if (!claimed) return { ok: true }; // lost race — already applied

  const { data: request } = await admin
    .from("service_requests")
    .select("id, customer_id, status, selection_id")
    .eq("id", session.service_request_id)
    .maybeSingle();
  if (!request) return { ok: true };

  // Close prior selection if still active-ish
  await admin
    .from("marketplace_selections")
    .update({
      status: input.reason === "timed_out" ? "timed_out" : "declined",
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.selection_id)
    .in("status", ["pending_unlock", "declined", "timed_out"]);

  const { data: runnerUps } = await admin
    .from("marketplace_offers")
    .select("id, provider_id, created_at")
    .eq("service_request_id", session.service_request_id)
    .eq("status", "superseded")
    .neq("provider_id", session.provider_id)
    .order("created_at", { ascending: true })
    .limit(5);

  const next = (runnerUps ?? [])[0];
  if (!next) {
    await admin
      .from("service_requests")
      .update({ selection_id: null, updated_at: new Date().toISOString() })
      .eq("id", session.service_request_id);

    void syncMarketplaceRequestProjection({
      serviceRequestId: session.service_request_id as string,
      legacyStatus: (request.status as "pending") ?? "pending",
      lifecycleVersion: 2,
      selectionId: null,
      phase: "offering",
    });

    await deliverMarketplaceNotification({
      userId: request.customer_id as string,
      type: "unlock_fallback_exhausted",
      titleKey: "notifications.unlockFallbackExhausted.title",
      bodyKey: "notifications.unlockFallbackExhausted.body",
      href: `/request/${session.service_request_id}/waiting`,
      requestId: session.service_request_id as string,
    });

    return { ok: true };
  }

  const now = new Date().toISOString();
  await admin
    .from("marketplace_offers")
    .update({ status: "selected", updated_at: now })
    .eq("id", next.id);

  const { data: newSelection, error: selError } = await admin
    .from("marketplace_selections")
    .insert({
      service_request_id: session.service_request_id,
      provider_id: next.provider_id,
      offer_id: next.id,
      status: "pending_unlock",
      selected_at: now,
    })
    .select("id")
    .single();

  if (selError || !newSelection) {
    return { ok: false, error: selError?.message ?? "fallback_selection_failed" };
  }

  await admin
    .from("service_requests")
    .update({ selection_id: newSelection.id, updated_at: now })
    .eq("id", session.service_request_id);

  void syncMarketplaceRequestProjection({
    serviceRequestId: session.service_request_id as string,
    legacyStatus: (request.status as "pending") ?? "pending",
    lifecycleVersion: 2,
    selectionId: newSelection.id,
    phase: "unlock_pending",
  });

  const opened = await openUnlockSessionForSelection({
    selectionId: newSelection.id as string,
  });

  await deliverMarketplaceNotification({
    userId: request.customer_id as string,
    type: "unlock_fallback",
    titleKey: "notifications.unlockFallback.title",
    bodyKey: "notifications.unlockFallback.body",
    href: `/request/${session.service_request_id}/waiting`,
    requestId: session.service_request_id as string,
  });

  return {
    ok: true,
    fallbackSelectionId: opened.ok ? newSelection.id : newSelection.id,
  };
}

/**
 * Process expired unlock SLAs. Safe to run repeatedly (idempotent per session).
 */
export async function processUnlockSlaTimeouts(limit = 50): Promise<{
  scanned: number;
  timedOut: number;
  fallbacks: number;
  errors: string[];
}> {
  if (!isUnlockV2Enabled()) {
    return { scanned: 0, timedOut: 0, fallbacks: 0, errors: [] };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: due } = await admin
    .from("unlock_sessions")
    .select("id, provider_id")
    .in("status", ["opened", "payment_pending"])
    .lte("sla_deadline", now)
    .order("sla_deadline", { ascending: true })
    .limit(limit);

  const errors: string[] = [];
  let timedOut = 0;
  let fallbacks = 0;

  for (const row of due ?? []) {
    // Grace: do not timeout while unlock fee receipt awaits admin review
    const { data: reviewing } = await admin
      .from("payments")
      .select("id")
      .eq("unlock_session_id", row.id)
      .eq("purpose", "unlock_fee")
      .eq("payment_status", "pending_review")
      .limit(1)
      .maybeSingle();
    if (reviewing) continue;

    const { data: updated } = await admin
      .from("unlock_sessions")
      .update({ status: "timed_out", updated_at: now, closed_at: now })
      .eq("id", row.id)
      .in("status", ["opened", "payment_pending"])
      .select("id, selection_id")
      .maybeSingle();

    if (!updated) continue;
    timedOut += 1;

    await admin
      .from("marketplace_selections")
      .update({ status: "timed_out", updated_at: now })
      .eq("id", updated.selection_id);

    await admin.from("unlock_reliability_signals").insert({
      unlock_session_id: row.id,
      provider_id: row.provider_id,
      signal_type: "timed_out",
    });

    const fb = await applyUnlockFallback({
      sessionId: row.id as string,
      reason: "timed_out",
    });
    if (fb.ok && fb.fallbackSelectionId) fallbacks += 1;
    if (!fb.ok) errors.push(`${row.id}:${fb.error}`);
  }

  return {
    scanned: (due ?? []).length,
    timedOut,
    fallbacks,
    errors,
  };
}
