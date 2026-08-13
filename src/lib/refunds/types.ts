/** Sprint 6 Phase 5 — refund & dispute types */

export type RefundType = "full" | "partial" | "manual" | "automatic";

export type RefundStatus =
  | "requested"
  | "pending"
  | "approved"
  | "rejected"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export type DisputeStatus =
  | "opened"
  | "evidence_requested"
  | "evidence_submitted"
  | "under_review"
  | "won"
  | "lost"
  | "closed";

export type RefundRequest = {
  id: string;
  paymentId: string;
  providerId: string;
  refundType: RefundType;
  status: RefundStatus;
  originalAmount: number;
  refundAmount: number;
  remainingAmount: number;
  currency: string;
  reason: string;
  requestedBy: string | null;
  approvedBy: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  stripeRefundId: string | null;
  paymentReference: string | null;
  financialDocumentId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentDispute = {
  id: string;
  paymentId: string | null;
  providerId: string | null;
  stripeDisputeId: string | null;
  stripeChargeId: string | null;
  status: DisputeStatus;
  reason: string | null;
  amount: number | null;
  currency: string;
  evidenceDueBy: string | null;
  resolution: string | null;
  openedAt: string;
  closedAt: string | null;
};
