import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOffersV2Enabled } from "@/lib/config/feature-flags";
import {
  OFFER_CLARIFICATION_MAX,
  type OfferClarificationView,
  type OfferTemplateView,
} from "@/domains/offer/types";

export type ProviderOpportunity = {
  assignmentId: string;
  serviceRequestId: string;
  rankInPool: number;
  source: string;
  assignedAt: string;
  title: string;
  intentText: string | null;
  urgency: string | null;
  cityId: string | null;
  hasOffer: boolean;
  offerId: string | null;
  /** Matching explainability — never includes subscription codes */
  reasons: import("@/domains/matching/reasons").MatchReason[];
  aiMatchScore: number | null;
  aiExplanation: Array<{
    code: string;
    params?: Record<string, string | number>;
    labelEn?: string;
  }>;
  etaLabel: string | null;
  operationalScore: number | null;
  responseBand: string | null;
};

/**
 * List open opportunities for a provider from match_assignments.
 *
 * Hydrates request rows via admin after assignment ownership is confirmed under
 * the user session — legacy RLS only allowed sr.provider_id, which is null on v2.
 */
export async function listProviderOpportunities(
  providerId: string,
): Promise<ProviderOpportunity[]> {
  if (!isOffersV2Enabled()) return [];

  const supabase = await createClient();
  const { data: assignments, error: assignError } = await supabase
    .from("match_assignments")
    .select(
      "id, service_request_id, rank_in_pool, source, assigned_at, reason_codes, ai_match_score, ai_explanation, eta_label, operational_score, response_band",
    )
    .eq("provider_id", providerId)
    .order("assigned_at", { ascending: false })
    .limit(50);

  if (assignError || !assignments?.length) return [];

  const requestIds = assignments.map((a) => a.service_request_id as string);

  // Admin hydrate: assigned provider is authorized via match_assignments RLS above.
  const admin = createAdminClient();
  const { data: requests } = await admin
    .from("service_requests")
    .select("id, title, intent_text, description, urgency, city_id, lifecycle_version, selection_id")
    .in("id", requestIds)
    .eq("lifecycle_version", 2);

  const rmap = new Map((requests ?? []).map((r) => [r.id as string, r]));

  const { data: offers } = await supabase
    .from("marketplace_offers")
    .select("id, service_request_id, match_assignment_id, status")
    .eq("provider_id", providerId)
    .in("service_request_id", requestIds)
    .in("status", ["sent", "selected"]);

  const offerByAssignment = new Map(
    (offers ?? []).map((o) => [o.match_assignment_id as string, o]),
  );

  const result: ProviderOpportunity[] = [];
  for (const a of assignments) {
    const req = rmap.get(a.service_request_id as string);
    if (!req) continue;
    if (req.selection_id) continue; // closed for new offers from this provider's view
    const offer = offerByAssignment.get(a.id as string);
    result.push({
      assignmentId: a.id as string,
      serviceRequestId: a.service_request_id as string,
      rankInPool: Number(a.rank_in_pool ?? 0),
      source: a.source as string,
      assignedAt: a.assigned_at as string,
      title: (req.title as string) || "",
      intentText: (req.intent_text as string) || (req.description as string) || null,
      urgency: (req.urgency as string) || null,
      cityId: (req.city_id as string) || null,
      hasOffer: Boolean(offer),
      offerId: offer ? (offer.id as string) : null,
      reasons: Array.isArray(a.reason_codes)
        ? (a.reason_codes as import("@/domains/matching/reasons").MatchReason[])
        : [],
      aiMatchScore:
        a.ai_match_score == null ? null : Number(a.ai_match_score),
      aiExplanation: Array.isArray(a.ai_explanation)
        ? (a.ai_explanation as ProviderOpportunity["aiExplanation"])
        : [],
      etaLabel: (a.eta_label as string | null) ?? null,
      operationalScore:
        a.operational_score == null ? null : Number(a.operational_score),
      responseBand: (a.response_band as string | null) ?? null,
    });
  }
  return result;
}

export async function getOpportunityDetail(input: {
  providerId: string;
  assignmentId: string;
}): Promise<{
  assignmentId: string;
  serviceRequestId: string;
  title: string;
  intentText: string | null;
  urgency: string | null;
  locationText: string | null;
  existingOfferId: string | null;
  reasons: import("@/domains/matching/reasons").MatchReason[];
  aiMatchScore: number | null;
  aiExplanation: ProviderOpportunity["aiExplanation"];
} | null> {
  if (!isOffersV2Enabled()) return null;
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("match_assignments")
    .select(
      "id, service_request_id, provider_id, reason_codes, ai_match_score, ai_explanation",
    )
    .eq("id", input.assignmentId)
    .eq("provider_id", input.providerId)
    .maybeSingle();
  if (!assignment) return null;

  const admin = createAdminClient();
  const { data: request } = await admin
    .from("service_requests")
    .select("id, title, intent_text, description, urgency, location_text, lifecycle_version, selection_id")
    .eq("id", assignment.service_request_id)
    .maybeSingle();
  if (!request || (request.lifecycle_version ?? 1) < 2) return null;

  const { data: offer } = await supabase
    .from("marketplace_offers")
    .select("id")
    .eq("match_assignment_id", assignment.id)
    .in("status", ["sent", "selected"])
    .maybeSingle();

  return {
    assignmentId: assignment.id as string,
    serviceRequestId: request.id as string,
    title: (request.title as string) || "",
    intentText:
      (request.intent_text as string) || (request.description as string) || null,
    urgency: (request.urgency as string) || null,
    locationText: (request.location_text as string) || null,
    existingOfferId: offer ? (offer.id as string) : null,
    reasons: Array.isArray(assignment.reason_codes)
      ? (assignment.reason_codes as import("@/domains/matching/reasons").MatchReason[])
      : [],
    aiMatchScore:
      assignment.ai_match_score == null
        ? null
        : Number(assignment.ai_match_score),
    aiExplanation: Array.isArray(assignment.ai_explanation)
      ? (assignment.ai_explanation as ProviderOpportunity["aiExplanation"])
      : [],
  };
}

export async function listOfferTemplates(
  providerId: string,
): Promise<OfferTemplateView[]> {
  if (!isOffersV2Enabled()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("offer_templates")
    .select("id, label, price, currency, price_model, inclusions, eta_text, message")
    .eq("provider_id", providerId)
    .order("updated_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    price: row.price != null ? Number(row.price) : null,
    currency: (row.currency as string) || "SYP",
    priceModel: row.price_model as OfferTemplateView["priceModel"],
    inclusions: (row.inclusions as string) ?? null,
    etaText: (row.eta_text as string) ?? null,
    message: (row.message as string) ?? null,
  }));
}

export async function saveOfferTemplate(input: {
  providerId: string;
  label: string;
  price?: number;
  currency?: string;
  priceModel?: OfferTemplateView["priceModel"];
  inclusions?: string;
  etaText?: string;
  message?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isOffersV2Enabled()) return { ok: false, error: "feature_disabled" };
  const label = input.label.trim();
  if (label.length < 2) return { ok: false, error: "label_required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offer_templates")
    .insert({
      provider_id: input.providerId,
      label,
      price: input.price ?? null,
      currency: input.currency || "SYP",
      price_model: input.priceModel || "fixed",
      inclusions: input.inclusions?.trim() || null,
      eta_text: input.etaText?.trim() || null,
      message: input.message?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "template_failed" };
  return { ok: true, id: data.id as string };
}

export async function listClarifications(
  offerId: string,
): Promise<OfferClarificationView[]> {
  if (!isOffersV2Enabled()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("offer_clarifications")
    .select("id, offer_id, author_role, body, created_at")
    .eq("offer_id", offerId)
    .order("created_at", { ascending: true })
    .limit(OFFER_CLARIFICATION_MAX);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    offerId: row.offer_id as string,
    authorRole: row.author_role as "customer" | "provider",
    body: row.body as string,
    createdAt: row.created_at as string,
  }));
}

export async function postClarification(input: {
  userId: string;
  offerId: string;
  role: "customer" | "provider";
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isOffersV2Enabled()) return { ok: false, error: "feature_disabled" };
  const body = input.body.trim();
  if (body.length < 1 || body.length > 500) return { ok: false, error: "body_invalid" };

  const supabase = await createClient();
  const { data: offer } = await supabase
    .from("marketplace_offers")
    .select("id, service_request_id, provider_id, status")
    .eq("id", input.offerId)
    .maybeSingle();
  if (!offer || offer.status !== "sent") return { ok: false, error: "offer_closed" };

  const { count } = await supabase
    .from("offer_clarifications")
    .select("id", { count: "exact", head: true })
    .eq("offer_id", input.offerId);
  if ((count ?? 0) >= OFFER_CLARIFICATION_MAX) {
    return { ok: false, error: "clarification_limit" };
  }

  if (input.role === "customer") {
    const { data: req } = await supabase
      .from("service_requests")
      .select("id")
      .eq("id", offer.service_request_id)
      .eq("customer_id", input.userId)
      .maybeSingle();
    if (!req) return { ok: false, error: "forbidden" };
  } else {
    const { data: provider } = await supabase
      .from("providers")
      .select("id")
      .eq("id", offer.provider_id)
      .eq("owner_id", input.userId)
      .maybeSingle();
    if (!provider) return { ok: false, error: "forbidden" };
  }

  const { error } = await supabase.from("offer_clarifications").insert({
    offer_id: offer.id,
    service_request_id: offer.service_request_id,
    author_id: input.userId,
    author_role: input.role,
    body,
  });

  if (error) return { ok: false, error: "clarification_failed" };
  return { ok: true };
}

export async function getActiveSelectionForRequest(requestId: string): Promise<{
  id: string;
  offerId: string | null;
  providerId: string | null;
  status: string;
} | null> {
  if (!isOffersV2Enabled()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("marketplace_selections")
    .select("id, offer_id, provider_id, status")
    .eq("service_request_id", requestId)
    .in("status", ["pending_unlock", "unlocked"])
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    offerId: (data.offer_id as string) ?? null,
    providerId: (data.provider_id as string) ?? null,
    status: data.status as string,
  };
}
