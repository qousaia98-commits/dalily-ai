"use client";

import { createClient } from "@/lib/supabase/client";
import { putFileToStorage } from "@/lib/supabase/direct-upload";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, PROVIDER_MEDIA_BUCKET } from "@/lib/providers/constants";

export type ProviderImageUploadProgress = {
  phase: "validating" | "preparing" | "uploading" | "confirming" | "done";
  /** 0–100 */
  percent: number;
};

type PrepareResult = {
  success: boolean;
  error?: string;
  upload?: { path: string; token: string; signedUrl: string };
};

type ConfirmResult = {
  success: boolean;
  error?: string;
  message?: string;
};

/**
 * Direct-to-Storage provider image upload with progress.
 * Never sends the file body through a Server Action.
 */
export async function uploadProviderImageDirect(input: {
  providerId: string;
  kind: "avatar" | "cover" | "gallery";
  file: File;
  prepare: (meta: {
    providerId: string;
    kind: string;
    fileName: string;
    mimeType: string;
    size: number;
  }) => Promise<PrepareResult>;
  confirm: (meta: {
    providerId: string;
    kind: string;
    path: string;
    mimeType: string;
    size: number;
  }) => Promise<ConfirmResult>;
  onProgress?: (progress: ProviderImageUploadProgress) => void;
}): Promise<{ success: boolean; error?: string }> {
  const { providerId, kind, file, prepare, confirm, onProgress } = input;

  onProgress?.({ phase: "validating", percent: 5 });

  if (file.size <= 0) return { success: false, error: "file_required" };
  if (file.size > MAX_IMAGE_BYTES) return { success: false, error: "file_too_large" };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { success: false, error: "invalid_file_type" };
  }

  onProgress?.({ phase: "preparing", percent: 12 });

  const prepared = await prepare({
    providerId,
    kind,
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  });

  if (!prepared.success || !prepared.upload) {
    return { success: false, error: prepared.error ?? "upload_failed" };
  }

  onProgress?.({ phase: "uploading", percent: 20 });

  const uploaded = await putFileToStorage({
    bucket: PROVIDER_MEDIA_BUCKET,
    path: prepared.upload.path,
    token: prepared.upload.token,
    signedUrl: prepared.upload.signedUrl,
    file,
    mimeType: file.type,
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

  const confirmed = await confirm({
    providerId,
    kind,
    path: prepared.upload.path,
    mimeType: file.type,
    size: file.size,
  });

  if (!confirmed.success) {
    const supabase = createClient();
    await supabase.storage
      .from(PROVIDER_MEDIA_BUCKET)
      .remove([prepared.upload.path])
      .catch(() => undefined);
    return { success: false, error: confirmed.error ?? "upload_failed" };
  }

  onProgress?.({ phase: "done", percent: 100 });
  return { success: true };
}
