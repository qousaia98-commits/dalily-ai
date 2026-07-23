"use client";

import { createClient } from "@/lib/supabase/client";
import { putFileToStorage } from "@/lib/supabase/direct-upload";
import {
  PAYMENT_RECEIPTS_BUCKET,
  validateReceiptMeta,
} from "@/lib/payment/receipt-storage";

export type ReceiptUploadProgress = {
  phase: "validating" | "preparing" | "uploading" | "confirming" | "done";
  /** 0–100 */
  percent: number;
};

type PrepareResult = {
  success: boolean;
  error?: string;
  path?: string;
  token?: string;
  signedUrl?: string;
};

type ConfirmResult = {
  success: boolean;
  error?: string;
  message?: string;
};

/**
 * Direct-to-Storage receipt upload with progress.
 * Never sends the file body through a Server Action.
 */
export async function uploadPaymentReceiptDirect(input: {
  paymentId: string;
  file: File;
  prepare: (
    paymentId: string,
    meta: { fileName: string; mimeType: string; size: number },
  ) => Promise<PrepareResult>;
  confirm: (
    paymentId: string,
    meta: { path: string; mimeType: string; size: number },
  ) => Promise<ConfirmResult>;
  onProgress?: (progress: ReceiptUploadProgress) => void;
}): Promise<{ success: boolean; error?: string }> {
  const { paymentId, file, prepare, confirm, onProgress } = input;

  onProgress?.({ phase: "validating", percent: 5 });

  const validated = validateReceiptMeta({
    fileName: file.name,
    mimeType: file.type || guessMimeFromName(file.name),
    size: file.size,
  });
  if (!validated.ok) {
    return { success: false, error: validated.error };
  }

  onProgress?.({ phase: "preparing", percent: 12 });

  const prepared = await prepare(paymentId, {
    fileName: file.name,
    mimeType: validated.mimeType,
    size: file.size,
  });

  if (!prepared.success || !prepared.path) {
    return { success: false, error: prepared.error ?? "prepare_failed" };
  }

  onProgress?.({ phase: "uploading", percent: 20 });

  const uploaded = await putFileToStorage({
    bucket: PAYMENT_RECEIPTS_BUCKET,
    path: prepared.path,
    token: prepared.token,
    signedUrl: prepared.signedUrl,
    file,
    mimeType: validated.mimeType,
    onPercent: (ratio) => {
      onProgress?.({
        phase: "uploading",
        percent: Math.min(85, Math.round(20 + ratio * 65)),
      });
    },
  });

  if (!uploaded.ok) {
    return { success: false, error: "upload_failed" };
  }

  onProgress?.({ phase: "confirming", percent: 90 });

  const confirmed = await confirm(paymentId, {
    path: prepared.path,
    mimeType: validated.mimeType,
    size: file.size,
  });

  if (!confirmed.success) {
    const supabase = createClient();
    await supabase.storage
      .from(PAYMENT_RECEIPTS_BUCKET)
      .remove([prepared.path])
      .catch(() => undefined);
    return { success: false, error: confirmed.error ?? "save_failed" };
  }

  onProgress?.({ phase: "done", percent: 100 });
  return { success: true };
}

function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "";
}
