export const PAYMENT_RECEIPTS_BUCKET = "payment-receipts";

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_RECEIPT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export function buildPaymentReceiptPath(
  ownerId: string,
  providerId: string,
  paymentId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${ownerId}/${providerId}/${paymentId}/${Date.now()}-${safeName}`;
}
