/**
 * Sprint 10 Phase 4 — Enterprise payment types (provider-agnostic).
 */

export type WalletBalances = {
  walletId: string;
  userId: string;
  currency: string;
  available: number;
  reserved: number;
  pendingPayout: number;
  refund: number;
  bonus: number;
  status: "active" | "frozen" | "closed";
};

export type WalletLedgerEntry = {
  id: string;
  walletId: string;
  entryType: string;
  amount: number;
  currency: string;
  balanceAfter: number | null;
  paymentId: string | null;
  escrowId: string | null;
  payoutId: string | null;
  description: string | null;
  createdAt: string;
};

export type EscrowStatus =
  | "pending"
  | "reserved"
  | "released"
  | "refunded"
  | "partially_refunded"
  | "disputed"
  | "cancelled"
  | "expired";

export type EscrowHoldView = {
  id: string;
  paymentId: string | null;
  serviceRequestId: string | null;
  conversationId: string | null;
  customerId: string;
  providerId: string;
  amount: number;
  currency: string;
  platformFee: number;
  providerAmount: number;
  status: EscrowStatus;
  reservedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
};

export type FeeBreakdown = {
  platformFee: number;
  providerFee: number;
  customerFee: number;
  tax: number;
  discount: number;
  netToProvider: number;
  totalCharged: number;
  currency: string;
  appliedRuleCodes: string[];
};

export type PayoutMethod = "wallet" | "bank" | "stripe" | "manual";

export type PayoutView = {
  id: string;
  providerId: string;
  amount: number;
  currency: string;
  method: PayoutMethod;
  status: string;
  escrowId: string | null;
  scheduledAt: string | null;
  processedAt: string | null;
  createdAt: string;
};

export type PaymentEngineAction =
  | "initialize"
  | "authorize"
  | "capture"
  | "reserve"
  | "release"
  | "refund"
  | "partial_refund"
  | "cancel"
  | "retry"
  | "dispute";

/** Adapter channel ids — business logic never imports PSP SDKs. */
export type PaymentAdapterId =
  | "stripe"
  | "paypal"
  | "apple_pay"
  | "google_pay"
  | "cash"
  | "bank_transfer"
  | "wallet"
  | "manual"
  | "shamcash"
  | "future_syria"
  | "future_jordan"
  | "future_lebanon";
