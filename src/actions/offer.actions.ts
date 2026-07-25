"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isOffersV2Enabled } from "@/lib/config/feature-flags";
import {
  createOfferFromAssignment,
  selectOffer,
} from "@/domains/offer/create-offer";
import {
  postClarification,
  saveOfferTemplate,
} from "@/domains/offer/queries";
import { OFFER_PRICE_MODELS, type OfferPriceModel } from "@/domains/offer/types";

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

  revalidatePath("/business/opportunities");
  revalidatePath(`/business/opportunities/${matchAssignmentId}`);
  revalidatePath(`/request/${String(formData.get("serviceRequestId") || "")}/waiting`);

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

  revalidatePath("/account/requests");
  revalidatePath(`/account/requests/${result.serviceRequestId}`);
  revalidatePath(`/request/${result.serviceRequestId}/waiting`);
  return { success: true, selectionId: result.selectionId };
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
