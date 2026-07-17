export const PAYMENT_RECEIPTS_BUCKET = "payment-receipts";

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_RECEIPT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedReceiptMime = (typeof ALLOWED_RECEIPT_TYPES)[number];

export function normalizeReceiptMimeType(mimeType: string): string {
  const raw = mimeType.trim().toLowerCase();
  if (raw === "image/jpg") return "image/jpeg";
  return raw;
}

export function isAllowedReceiptMime(mimeType: string): mimeType is AllowedReceiptMime {
  const normalized = normalizeReceiptMimeType(mimeType);
  return (ALLOWED_RECEIPT_TYPES as readonly string[]).includes(normalized);
}

export function validateReceiptMeta(input: {
  fileName: string;
  mimeType: string;
  size: number;
}): { ok: true; mimeType: AllowedReceiptMime } | { ok: false; error: string } {
  if (!input.fileName.trim()) {
    return { ok: false, error: "file_required" };
  }
  if (!input.size || input.size <= 0) {
    return { ok: false, error: "file_required" };
  }
  if (input.size > MAX_RECEIPT_BYTES) {
    return { ok: false, error: "file_too_large" };
  }
  const mimeType = normalizeReceiptMimeType(input.mimeType);
  if (!isAllowedReceiptMime(mimeType)) {
    return { ok: false, error: "invalid_file_type" };
  }
  return { ok: true, mimeType };
}

export function buildPaymentReceiptPath(
  ownerId: string,
  providerId: string,
  paymentId: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${ownerId}/${providerId}/${paymentId}/${Date.now()}-${safeName}`;
}

/** True when path belongs to this owner/provider/payment (anti-tamper). */
export function isOwnedReceiptPath(
  path: string,
  ownerId: string,
  providerId: string,
  paymentId: string,
): boolean {
  const prefix = `${ownerId}/${providerId}/${paymentId}/`;
  return path.startsWith(prefix) && !path.includes("..");
}
