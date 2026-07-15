export type PlanSlug = "free" | "pro" | "premium";

export type PlanFeatures = {
  maxServices: number | null;
  maxImages: number | null;
  searchVisible: boolean;
  basicAnalytics: boolean;
  verifiedBadge: boolean;
  advancedAnalytics: boolean;
  aiProfileOptimization: boolean;
  priorityVerification: boolean;
  featuredSection: boolean;
  premiumBadge: boolean;
  profileVideo: boolean;
  customPage: boolean;
  prioritySupport: boolean;
  earlyAccess: boolean;
  rankingBonus: number;
};

export type SubscriptionPlanRow = {
  id: string;
  slug: PlanSlug;
  name: { ar: string; en: string };
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  features: PlanFeatures;
  isActive: boolean;
};

export type SubscriptionRow = {
  id: string;
  providerId: string;
  planId: string;
  planSlug: PlanSlug;
  status: import("@/types/database.types").SubscriptionStatus;
  startsAt: string;
  expiresAt: string | null;
  autoRenew: boolean;
};

export type PaymentRow = {
  id: string;
  providerId: string;
  subscriptionId: string | null;
  paymentProvider: import("@/types/database.types").PaymentProviderType;
  paymentStatus: import("@/types/database.types").PaymentStatus;
  amount: number;
  currency: string;
  paymentReference: string;
  receiptPath: string | null;
  receiptMimeType: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  adminNote: string | null;
  externalTransactionId: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type InvoiceRow = {
  id: string;
  providerId: string;
  paymentId: string | null;
  invoiceNumber: string;
  subtotal: number;
  total: number;
  currency: string;
  status: import("@/types/database.types").InvoiceStatus;
  createdAt: string;
};

export type CreatePaymentResult = {
  paymentId: string;
  instructions?: {
    receiver: string;
    account: string;
    swift?: string;
    bankName?: string;
    amount: number;
    currency: string;
    reference: string;
  };
};

export type VerifyPaymentResult = {
  success: boolean;
  paymentId: string;
  externalTransactionId?: string;
};
