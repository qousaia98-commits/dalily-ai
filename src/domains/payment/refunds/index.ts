/**
 * Refund domain facade — wraps Sprint 6 refunds + escrow refunds.
 */

export {
  requestRefund,
  approveRefund,
  rejectRefund,
  completeRefundSuccess,
  markRefundFailed,
  getRefundById,
  listRefunds,
  getRefundStats,
  listDisputes,
  getDisputeById,
} from "@/lib/refunds";

export { refundEscrow } from "@/domains/payment/escrow/engine";
export { refundPayment } from "@/domains/payment/engine/payment-engine";
