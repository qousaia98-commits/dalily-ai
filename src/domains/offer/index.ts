/**
 * SAD Offer domain — competing offers from match assignments (Sprint 4).
 * @see docs/migration/sprint-4-notes.md
 */

export const OFFER_DOMAIN = {
  service: "offer",
  owns: ["marketplace_offers", "offer_templates", "offer_clarifications", "offer_quality_flags"],
  impl: ["src/domains/offer", "quotes via service-requests/actions (legacy dual-run)"],
  status: "active",
  sprint: 4,
  featureFlag: "OFFERS_V2",
} as const;

export {
  OFFER_COMPARE_MAX,
  OFFER_CLARIFICATION_MAX,
  OFFER_PRICE_MODELS,
  OFFER_STATUSES,
  type CreateOfferInput,
  type MarketplaceOfferView,
  type OfferClarificationView,
  type OfferPriceModel,
  type OfferStatus,
  type OfferTemplateView,
} from "@/domains/offer/types";

export {
  computeOfferQualityFlags,
  OFFER_QUALITY_FLAG_CODES,
  type OfferQualityFlag,
} from "@/domains/offer/quality";

export {
  createOfferFromAssignment,
  listOffersForRequest,
  selectOffer,
  declineOffer,
  getOfferForProvider,
  getCustomerOfferContext,
} from "@/domains/offer/create-offer";

export {
  listProviderOpportunities,
  getOpportunityDetail,
  listOfferTemplates,
  saveOfferTemplate,
  listClarifications,
  postClarification,
  getActiveSelectionForRequest,
  type ProviderOpportunity,
} from "@/domains/offer/queries";
