/** Dual Marketplace — Sprint 4 Phase 1 types. */

export type MarketplacePath = "publish" | "find";

export type MarketplacePathRecommendation = {
  version: 1;
  path: MarketplacePath;
  confidence: number;
  reasonKey: string;
  reasonEn: string;
  reasonAr: string;
  /** Underlying AI workflow strategy when available */
  strategy:
    | "emergency_dispatch"
    | "guided_diagnosis"
    | "collect_offers"
    | "direct_contact"
    | null;
};

export type DualMarketplaceChoice = {
  path: MarketplacePath;
  recommendedPath: MarketplacePath | null;
  acceptedRecommendation: boolean;
  intentText?: string;
};
