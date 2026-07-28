export const OFFER_PRICE_MODELS = ["fixed", "hourly", "estimate"] as const;
export type OfferPriceModel = (typeof OFFER_PRICE_MODELS)[number];

export const OFFER_STATUSES = [
  "sent",
  "withdrawn",
  "selected",
  "superseded",
  "expired",
  "declined",
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Customer compare strip — PSD/roadmap max 3. */
export const OFFER_COMPARE_MAX = 3;

/** Soft cap on clarifications per offer (structured Q&A, not chat). */
export const OFFER_CLARIFICATION_MAX = 8;

export type MarketplaceOfferView = {
  id: string;
  serviceRequestId: string;
  matchAssignmentId: string;
  providerId: string;
  providerName: string | null;
  providerAvatarUrl: string | null;
  verificationStatus: string | null;
  ratingAvg: number | null;
  reviewCount: number | null;
  price: number;
  currency: string;
  priceModel: OfferPriceModel;
  inclusions: string | null;
  etaText: string | null;
  message: string | null;
  expiresAt: string | null;
  status: OfferStatus;
  qualityFlags: string[];
  createdAt: string;
};

export type OfferTemplateView = {
  id: string;
  label: string;
  price: number | null;
  currency: string;
  priceModel: OfferPriceModel;
  inclusions: string | null;
  etaText: string | null;
  message: string | null;
};

export type OfferClarificationView = {
  id: string;
  offerId: string;
  authorRole: "customer" | "provider";
  body: string;
  createdAt: string;
};

export type CreateOfferInput = {
  matchAssignmentId: string;
  price: number;
  currency: string;
  priceModel: OfferPriceModel;
  inclusions?: string;
  etaText?: string;
  message?: string;
  templateId?: string;
  /** Hours until expiry; default 48. */
  expiresInHours?: number;
};
