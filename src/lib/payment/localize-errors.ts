/**
 * Map payment/unlock error codes to user-facing copy.
 * Never return raw i18n paths or internal codes.
 */

type TranslateFn = {
  (key: string): string;
  has: (key: string) => boolean;
};

function asTranslateFn(t: unknown): TranslateFn {
  const fn = t as TranslateFn;
  if (typeof fn.has !== "function") {
    return Object.assign(((key: string) => String(fn(key))) as TranslateFn, {
      has: () => true,
    });
  }
  return fn;
}

const RECEIPT_ERROR_KEYS = [
  "file_required",
  "file_too_large",
  "invalid_file_type",
  "upload_failed",
  "save_failed",
  "prepare_failed",
  "duplicate_receipt",
  "payment_not_submittable",
  "invalid_payment",
  "use_direct_upload",
  "receipt_failed",
] as const;

/**
 * Resolve a receipt/upload error code via paymentReceiptUpload.errors.*
 * Falls back to a generic localized message — never exposes the raw code.
 */
export function localizeReceiptUploadError(
  tRaw: unknown,
  code: string | null | undefined,
): string {
  const t = asTranslateFn(tRaw);
  const normalized = (code ?? "").trim();
  if (normalized) {
    const key = `errors.${normalized}`;
    if (t.has(key)) return t(key);
    if (normalized === "receipt_failed" && t.has("errors.upload_failed")) {
      return t("errors.upload_failed");
    }
  }
  if (t.has("errors.generic")) return t("errors.generic");
  if (t.has("errors.upload_failed")) return t("errors.upload_failed");
  return t("errors.file_required");
}

/**
 * Resolve Cham Cash transaction verification error codes via
 * paymentExperience.shamcash.errors.*
 */
export function localizeChamCashError(
  tRaw: unknown,
  code: string | null | undefined,
): string {
  const t = asTranslateFn(tRaw);
  const normalized = (code ?? "").trim() || "verification_unavailable";
  const key = `errors.${normalized}`;
  if (t.has(key)) return t(key);
  return t("errors.verification_unavailable");
}

/**
 * Resolve unlockFlow action errors safely.
 */
export function localizeUnlockFlowError(
  tRaw: unknown,
  code: string | null | undefined,
): string {
  const t = asTranslateFn(tRaw);
  const normalized = (code ?? "").trim() || "failed";
  const key = `errors.${normalized}`;
  if (t.has(key)) return t(key);

  if ((RECEIPT_ERROR_KEYS as readonly string[]).includes(normalized)) {
    if (t.has("errors.receipt_failed")) return t("errors.receipt_failed");
  }

  return t.has("errors.failed") ? t("errors.failed") : "حدث خطأ.";
}
