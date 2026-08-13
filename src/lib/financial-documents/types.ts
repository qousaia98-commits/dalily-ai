/** Sprint 6 Phase 4 — financial document types */

export type FinancialDocumentType =
  | "business_subscription_invoice"
  | "lead_unlock_receipt"
  | "manual_payment_receipt"
  | "refund_credit_note";

export type FinancialDocumentStatus =
  | "draft"
  | "issued"
  | "void"
  | "regenerated";

export type CompanyBillingSettings = {
  id: string;
  companyName: string;
  companyAddress: string;
  country: string;
  vatNumber: string;
  taxId: string;
  supportEmail: string;
  website: string;
  phone: string;
  invoiceFooter: string;
  legalNotice: string;
  currency: string;
  defaultTaxRate: number;
  logoPath: string | null;
};

export type FinancialDocument = {
  id: string;
  documentNumber: string;
  documentType: FinancialDocumentType;
  paymentId: string;
  providerId: string;
  status: FinancialDocumentStatus;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  issueDate: string;
  paymentDate: string | null;
  storagePath: string | null;
  storageBucket: string;
  generatedAt: string;
  generatedBy: string | null;
};

export type InvoiceMetadata = {
  documentId: string;
  providerName: string | null;
  providerCompany: string | null;
  subscriptionPlan: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  paymentReference: string | null;
  stripeReference: string | null;
  paymentStatus: string | null;
  lineDescription: string | null;
};

export type ReceiptMetadata = {
  documentId: string;
  leadId: string | null;
  unlockSessionId: string | null;
  unlockDate: string | null;
  aiPriceUsd: number | null;
  pricingExplanation: string | null;
  estimatedProjectValue: number | null;
  estimatedDurationHours: number | null;
  providerName: string | null;
  paymentReference: string | null;
  stripePaymentIntent: string | null;
};

export type DocumentListItem = FinancialDocument & {
  providerName?: string | null;
  paymentReference?: string | null;
};
