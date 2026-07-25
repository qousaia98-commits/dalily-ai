import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOffersV2Enabled, isUnlockV2Enabled } from "@/lib/config/feature-flags";
import { computeOfferQualityFlags } from "@/domains/offer/quality";
import type { CreateOfferInput, MarketplaceOfferView } from "@/domains/offer/types";
import { syncMarketplaceRequestProjection } from "@/domains/marketplace/projection";
import { openUnlockSessionForSelection } from "@/domains/unlock/session";
import { deliverMarketplaceNotification } from "@/lib/notifications/deliver";
import { safeLocalizedText, safeMarketplaceCopy } from "@/lib/translation/guard";

export type CreateOfferResult =
  | { ok: true; offerId: string; qualityFlags: string[] }
  | { ok: false; error: string };

/**
 * Create a competing offer. Must be rooted in the caller's match_assignment.
 * Does not accept the request, open chat, or release PII.
 */
export async function createOfferFromAssignment(input: {
  providerId: string;
  ownerUserId: string;
  data: CreateOfferInput;
}): Promise<CreateOfferResult> {
  if (!isOffersV2Enabled()) return { ok: false, error: "feature_disabled" };

  const price = input.data.price;
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "price_invalid" };

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("match_assignments")
    .select("id, service_request_id, provider_id")
    .eq("id", input.data.matchAssignmentId)
    .eq("provider_id", input.providerId)
    .maybeSingle();

  if (!assignment) return { ok: false, error: "assignment_required" };

  const { data: request } = await supabase
    .from("service_requests")
    .select("id, customer_id, lifecycle_version, provider_id, status")
    .eq("id", assignment.service_request_id)
    .maybeSingle();

  if (!request) return { ok: false, error: "not_found" };
  if ((request.lifecycle_version ?? 1) < 2) return { ok: false, error: "not_marketplace_native" };
  if (request.provider_id) return { ok: false, error: "legacy_assigned" };

  const { data: existingSelection } = await supabase
    .from("marketplace_selections")
    .select("id")
    .eq("service_request_id", request.id)
    .in("status", ["pending_unlock", "unlocked"])
    .maybeSingle();
  if (existingSelection) return { ok: false, error: "already_selected" };

  const qualityFlags = computeOfferQualityFlags({
    message: input.data.message,
    etaText: input.data.etaText,
    inclusions: input.data.inclusions,
  });

  const expiresHours = input.data.expiresInHours ?? 48;
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

  // Supersede prior sent offer for this provider+request (unique partial index).
  await supabase
    .from("marketplace_offers")
    .update({ status: "superseded", updated_at: new Date().toISOString() })
    .eq("service_request_id", request.id)
    .eq("provider_id", input.providerId)
    .eq("status", "sent");

  const { data: offer, error } = await supabase
    .from("marketplace_offers")
    .insert({
      service_request_id: request.id,
      match_assignment_id: assignment.id,
      provider_id: input.providerId,
      price,
      currency: (input.data.currency || "SYP").trim().slice(0, 8) || "SYP",
      price_model: input.data.priceModel,
      inclusions: input.data.inclusions?.trim() || null,
      eta_text: input.data.etaText?.trim() || null,
      message: input.data.message?.trim() || null,
      expires_at: expiresAt,
      status: "sent",
      quality_flags: qualityFlags,
      template_id: input.data.templateId || null,
    })
    .select("id")
    .single();

  if (error || !offer) {
    if (error?.code === "23505") return { ok: false, error: "offer_exists" };
    return { ok: false, error: "offer_failed" };
  }

  // Provider has no ownership column on marketplace-native rows (provider_id null).
  // Use admin to bump updated_at so customer realtime on service_requests fires.
  const admin = createAdminClient();
  await admin
    .from("service_requests")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", request.id);

  void syncMarketplaceRequestProjection({
    serviceRequestId: request.id,
    legacyStatus: (request.status as "pending") ?? "pending",
    lifecycleVersion: 2,
    phase: "offering",
  });

  void deliverMarketplaceNotification({
    userId: request.customer_id as string,
    type: "offer_received",
    titleKey: "notifications.offerReceived.title",
    bodyKey: "notifications.offerReceived.body",
    href: `/request/${request.id}/waiting`,
    requestId: request.id as string,
  });

  return { ok: true, offerId: offer.id, qualityFlags };
}

function mapOfferRow(row: Record<string, unknown>, provider?: {
  name?: unknown;
  verification_status?: string | null;
  rating_avg?: number | null;
}): MarketplaceOfferView {
  const nameJson = provider?.name as { ar?: string; en?: string } | string | null | undefined;
  let providerName: string | null = null;
  if (typeof nameJson === "string") {
    providerName = safeMarketplaceCopy(nameJson);
  } else if (nameJson && typeof nameJson === "object") {
    // Prefer Arabic source for Syria marketplace; fall back to safe English.
    providerName =
      safeLocalizedText(nameJson, "ar") || safeLocalizedText(nameJson, "en") || null;
  }

  return {
    id: row.id as string,
    serviceRequestId: row.service_request_id as string,
    matchAssignmentId: row.match_assignment_id as string,
    providerId: row.provider_id as string,
    providerName,
    verificationStatus: provider?.verification_status ?? null,
    ratingAvg: provider?.rating_avg ?? null,
    price: Number(row.price),
    currency: row.currency as string,
    priceModel: row.price_model as MarketplaceOfferView["priceModel"],
    inclusions: safeMarketplaceCopy(row.inclusions as string | null),
    etaText: safeMarketplaceCopy(row.eta_text as string | null),
    message: safeMarketplaceCopy(row.message as string | null),
    expiresAt: (row.expires_at as string) ?? null,
    status: row.status as MarketplaceOfferView["status"],
    qualityFlags: Array.isArray(row.quality_flags)
      ? (row.quality_flags as string[])
      : [],
    createdAt: row.created_at as string,
  };
}

export async function listOffersForRequest(
  requestId: string,
  opts?: { customerId?: string },
): Promise<MarketplaceOfferView[]> {
  if (!isOffersV2Enabled()) return [];

  const supabase = await createClient();
  if (opts?.customerId) {
    const { data: owned } = await supabase
      .from("service_requests")
      .select("id")
      .eq("id", requestId)
      .eq("customer_id", opts.customerId)
      .maybeSingle();
    if (!owned) return [];
  }

  const { data: rows } = await supabase
    .from("marketplace_offers")
    .select(
      "id, service_request_id, match_assignment_id, provider_id, price, currency, price_model, inclusions, eta_text, message, expires_at, status, quality_flags, created_at",
    )
    .eq("service_request_id", requestId)
    .in("status", ["sent", "selected"])
    .order("created_at", { ascending: true });

  if (!rows?.length) return [];

  const providerIds = [...new Set(rows.map((r) => r.provider_id as string))];
  const { data: providers } = await supabase
    .from("providers")
    .select("id, name, verification_status, rating_avg")
    .in("id", providerIds);

  const pmap = new Map((providers ?? []).map((p) => [p.id as string, p]));

  return rows.map((row) =>
    mapOfferRow(row as Record<string, unknown>, pmap.get(row.provider_id as string)),
  );
}

export async function getOfferForProvider(input: {
  offerId: string;
  providerId: string;
}): Promise<MarketplaceOfferView | null> {
  if (!isOffersV2Enabled()) return null;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("marketplace_offers")
    .select(
      "id, service_request_id, match_assignment_id, provider_id, price, currency, price_model, inclusions, eta_text, message, expires_at, status, quality_flags, created_at",
    )
    .eq("id", input.offerId)
    .eq("provider_id", input.providerId)
    .maybeSingle();
  if (!row) return null;
  return mapOfferRow(row as Record<string, unknown>);
}

/**
 * Customer selects one offer. Creates marketplace_selections; no PII, no chat, no provider_id bind.
 * When UNLOCK_V2 is on, opens unlock session + SLA (grant still requires success path).
 */
export async function selectOffer(input: {
  customerId: string;
  offerId: string;
}): Promise<{ ok: true; selectionId: string; serviceRequestId: string } | { ok: false; error: string }> {
  if (!isOffersV2Enabled()) return { ok: false, error: "feature_disabled" };

  const supabase = await createClient();
  const { data: offer } = await supabase
    .from("marketplace_offers")
    .select("id, service_request_id, provider_id, status")
    .eq("id", input.offerId)
    .eq("status", "sent")
    .maybeSingle();

  if (!offer) return { ok: false, error: "offer_not_found" };

  const { data: request } = await supabase
    .from("service_requests")
    .select("id, customer_id, lifecycle_version, status, selection_id")
    .eq("id", offer.service_request_id)
    .eq("customer_id", input.customerId)
    .maybeSingle();

  if (!request) return { ok: false, error: "forbidden" };
  if ((request.lifecycle_version ?? 1) < 2) return { ok: false, error: "not_marketplace_native" };
  if (request.selection_id) return { ok: false, error: "already_selected" };

  // Use admin for transactional multi-table write (selection insert policies absent).
  const admin = createAdminClient();

  const { data: selection, error: selError } = await admin
    .from("marketplace_selections")
    .insert({
      service_request_id: request.id,
      provider_id: offer.provider_id,
      offer_id: offer.id,
      status: "pending_unlock",
      selected_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (selError || !selection) {
    if (selError?.code === "23505") return { ok: false, error: "already_selected" };
    return { ok: false, error: "selection_failed" };
  }

  await admin
    .from("marketplace_offers")
    .update({ status: "selected", updated_at: new Date().toISOString() })
    .eq("id", offer.id);

  await admin
    .from("marketplace_offers")
    .update({ status: "superseded", updated_at: new Date().toISOString() })
    .eq("service_request_id", request.id)
    .eq("status", "sent")
    .neq("id", offer.id);

  await admin
    .from("service_requests")
    .update({
      selection_id: selection.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", request.id)
    .eq("customer_id", input.customerId);

  // Explicitly do NOT set provider_id / open conversation / release phone.
  void syncMarketplaceRequestProjection({
    serviceRequestId: request.id,
    legacyStatus: request.status as "pending",
    lifecycleVersion: 2,
    selectionId: selection.id,
    phase: "unlock_pending",
  });

  if (isUnlockV2Enabled()) {
    try {
      await openUnlockSessionForSelection({ selectionId: selection.id });
    } catch {
      // Selection must remain valid even if session open fails; can be retried.
    }
  }

  return { ok: true, selectionId: selection.id, serviceRequestId: request.id };
}
