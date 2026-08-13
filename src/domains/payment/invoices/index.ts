/**
 * Invoice domain facade — PDF-ready financial documents (Sprint 6).
 */

export {
  generateFinancialDocumentForPayment,
  ensureFinancialDocumentAfterPayment,
  listFinancialDocuments,
  getFinancialDocumentById,
  getDocumentStats,
  prepareRefundCreditNote,
  generateCreditNoteForRefund,
  createDocumentSignedUrl,
} from "@/lib/financial-documents";

export type {
  FinancialDocumentType,
  FinancialDocumentStatus,
  FinancialDocument,
  DocumentListItem,
} from "@/lib/financial-documents";
