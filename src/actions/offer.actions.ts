"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isOffersV2Enabled, isOfferDecisionEngineEnabled } from "@/lib/config/feature-flags";
import {
  createOfferFromAssignment,
  selectOffer,
  declineOffer,
} from "@/domains/offer/create-offer";
import {
  postClarification,
  saveOfferTemplate,
} from "@/domains/offer/queries";
import { toggleHiringShortlist } from "@/domains/offer/recommendation";
import { OFFER_PRICE_MODELS, type OfferPriceModel } from "@/domains/offer/types";
import { revalidateOrderSurfaces } from "@/lib/orders/revalidate";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

export type OfferActionState = {
  success: boolean;
  error?: string;
  offerId?: string;
  selectionId?: string;
  qualityFlags?: string[];
};

function parsePriceModel(raw: FormDataEntryValue | null): OfferPriceModel {
  const v = String(raw || "fixed");
  return (OFFER_PRICE_MODELS as readonly string[]).includes(v)
    ? (v as OfferPriceModel)
    : "fixed";
}

export async function createOfferAction(
  _prev: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  if (!isOffersV2Enabled()) return { success: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const price = Number(formData.get("price"));
  const matchAssignmentId = String(formData.get("matchAssignmentId") || "");
  if (!matchAssignmentId) return { success: false, error: "assignment_required" };

  const result = await createOfferFromAssignment({
    providerId: provider.id,
    ownerUserId: authUser.id,
    data: {
      matchAssignmentId,
      price,
      currency: String(formData.get("currency") || "SYP"),
      priceModel: parsePriceModel(formData.get("priceModel")),
      inclusions: String(formData.get("inclusions") || ""),
      etaText: String(formData.get("etaText") || ""),
      message: String(formData.get("message") || ""),
      templateId: String(formData.get("templateId") || "") || undefined,
    },
  });

  if (!result.ok) return { success: false, error: result.error };

  const serviceRequestId = String(formData.get("serviceRequestId") || "");
  revalidateOrderSurfaces(serviceRequestId || null);
  revalidatePath(`/business/opportunities/${matchAssignmentId}`);

  return {
    success: true,
    offerId: result.offerId,
    qualityFlags: result.qualityFlags,
  };
}

export async function selectOfferAction(offerId: string): Promise<OfferActionState> {
  if (!isOffersV2Enabled()) return { success: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const result = await selectOffer({ customerId: authUser.id, offerId });
  if (!result.ok) return { success: false, error: result.error };

  // Phase 2 learning: accepted provider improves future match confidence signals.
  try {
    const { isAiEngineV2Enabled } = await import("@/lib/config/feature-flags");
    if (isAiEngineV2Enabled()) {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { learnFromProviderDecision } = await import(
        "@/lib/ai/learning/match-feedback"
      );
      const admin = createAdminClient();
      const { data: offer } = await admin
        .from("marketplace_offers")
        .select("provider_id, service_request_id, match_assignment_id")
        .eq("id", offerId)
        .maybeSingle();
      if (offer?.provider_id) {
        let matchScore: number | null = null;
        if (offer.match_assignment_id) {
          const { data: assignment } = await admin
            .from("match_assignments")
            .select("ai_match_score")
            .eq("id", offer.match_assignment_id)
            .maybeSingle();
          matchScore =
            assignment?.ai_match_score == null
              ? null
              : Number(assignment.ai_match_score);
        }
        void learnFromProviderDecision({
          kind: "accepted",
          providerId: offer.provider_id as string,
          serviceRequestId: offer.service_request_id as string,
          customerId: authUser.id,
          matchScore,
        });
        const { compareDispatchPrediction } = await import(
          "@/lib/ai/dispatch/learning"
        );
        void compareDispatchPrediction({
          serviceRequestId: offer.service_request_id as string,
          providerId: offer.provider_id as string,
          actualAccepted: true,
          actualCustomerChose: true,
          actualRespondedAt: new Date().toISOString(),
        });
      }
    }
  } catch {
    // Learning must never break selection.
  }

  revalidateOrderSurfaces(result.serviceRequestId);
  revalidatePath("/business/unlock");
  return { success: true, selectionId: result.selectionId };
}

export async function declineOfferAction(offerId: string): Promise<OfferActionState> {
  if (!isOffersV2Enabled()) return { success: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const result = await declineOffer({ customerId: authUser.id, offerId });
  if (!result.ok) return { success: false, error: result.error };

  revalidateOrderSurfaces(result.serviceRequestId);
  revalidatePath(`/request/${result.serviceRequestId}/waiting`);
  revalidatePath(`/account/requests/${result.serviceRequestId}`);
  return { success: true };
}

export async function postOfferClarificationAction(
  _prev: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  if (!isOffersV2Enabled()) return { success: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const offerId = String(formData.get("offerId") || "");
  const roleRaw = String(formData.get("role") || "");
  const role = roleRaw === "provider" ? "provider" : "customer";
  const body = String(formData.get("body") || "");

  const result = await postClarification({
    userId: authUser.id,
    offerId,
    role,
    body,
  });
  if (!result.ok) return { success: false, error: result.error };
  revalidatePath(`/request/${String(formData.get("serviceRequestId") || "")}/waiting`);
  revalidatePath("/business/opportunities");
  revalidatePath(`/account/requests/${String(formData.get("serviceRequestId") || "")}`);
  return { success: true };
}

export async function saveOfferTemplateAction(
  _prev: OfferActionState,
  formData: FormData,
): Promise<OfferActionState> {
  if (!isOffersV2Enabled()) return { success: false, error: "feature_disabled" };
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) return { success: false, error: "forbidden" };

  const priceRaw = formData.get("price");
  const price = priceRaw ? Number(priceRaw) : undefined;

  const result = await saveOfferTemplate({
    providerId: provider.id,
    label: String(formData.get("label") || ""),
    price: Number.isFinite(price) ? price : undefined,
    currency: String(formData.get("currency") || "SYP"),
    priceModel: parsePriceModel(formData.get("priceModel")),
    inclusions: String(formData.get("inclusions") || ""),
    etaText: String(formData.get("etaText") || ""),
    message: String(formData.get("message") || ""),
  });

  if (!result.ok) return { success: false, error: result.error };
  revalidatePath("/business/opportunities");
  return { success: true };
}

export type ShortlistActionState = {
  success: boolean;
  error?: string;
  shortlisted?: boolean;
  ids?: string[];
};

export async function toggleHiringShortlistAction(input: {
  requestId: string;
  providerId: string;
}): Promise<ShortlistActionState> {
  if (!isOfferDecisionEngineEnabled()) {
    return { success: false, error: "feature_disabled" };
  }
  const authUser = await getAuthUser();
  if (!authUser) return { success: false, error: "login_required" };

  const rate = checkRateLimit(rateLimitKey("hiring_shortlist", authUser.id), {
    max: 40,
    windowMs: 60_000,
  });
  if (!rate.ok) return { success: false, error: "rate_limited" };

  const result = await toggleHiringShortlist({
    customerId: authUser.id,
    requestId: input.requestId,
    providerId: input.providerId,
  });

  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/request/${input.requestId}/waiting`);
  revalidatePath(`/account/requests/${input.requestId}`);
  return {
    success: true,
    shortlisted: result.shortlisted,
    ids: result.ids,
  };
}
