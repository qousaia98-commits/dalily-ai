/** Sprint 6 Phase 1 — Provider monetization types */

export type BillingMode = "free" | "business";

export type MonetizationBillingSettings = {
  id: string;
  businessPriceUsd: number;
  includedUnlocks: number;
  minLeadPriceUsd: number;
  maxLeadPriceUsd: number;
  baseLeadPriceUsd: number;
  emergencyMultiplier: number;
  urgencyMultiplier: number;
  multiServiceMultiplier: number;
  complexityMultiplier: number;
  distanceMultiplierPerKm: number;
  demandMultiplier: number;
  categoryMultipliers: Record<string, number>;
  currency: string;
};

export type ProviderMonetizationPlan = {
  providerId: string;
  billingMode: BillingMode;
  status: "active" | "past_due" | "cancelled";
  businessExpiresAt: string | null;
  premiumBadge: boolean;
  searchBoost: boolean;
  analyticsEnabled: boolean;
  marketingEnabled: boolean;
  aiInsightsEnabled: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  currentPeriodStart: string | null;
};

export type MonthlyUnlockUsage = {
  providerId: string;
  periodYm: string;
  includedAllowance: number;
  usedCount: number;
  remaining: number;
  resetAt: string | null;
};

export type LeadPricingFactors = {
  estimatedProjectValueUsd: number;
  categorySlug: string | null;
  urgency: "low" | "normal" | "high" | "emergency";
  isEmergency: boolean;
  isMultiService: boolean;
  complexity: "low" | "medium" | "high";
  estimatedDurationHours: number;
  distanceKm: number | null;
  demandLevel: "low" | "normal" | "high";
};

export type LeadPricingResult = {
  aiScore: number;
  basePriceUsd: number;
  finalPriceUsd: number;
  currency: string;
  factors: LeadPricingFactors & { multipliersApplied: Record<string, number> };
  explanationEn: string;
  explanationAr: string;
  estimatedProjectValueUsd: number;
  estimatedDurationHours: number;
  potentialRevenueUsd: number;
};

export type MonetizationDashboard = {
  plan: ProviderMonetizationPlan;
  usage: MonthlyUnlockUsage;
  monthSpendUsd: number;
  unlockedCount: number;
  settings: Pick<
    MonetizationBillingSettings,
    "businessPriceUsd" | "includedUnlocks" | "minLeadPriceUsd" | "maxLeadPriceUsd" | "currency"
  >;
};
