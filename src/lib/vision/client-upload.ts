/**
 * Client helpers for Vision image intake (compress, fingerprint, revoke).
 * Business logic stays out of React components.
 */

import { compressImageFile, fileFingerprint } from "@/lib/media/compress-image";
import {
  VISION_ALLOWED_MIME,
  VISION_COMPRESS_QUALITY,
  VISION_MAX_EDGE,
  VISION_MAX_IMAGE_BYTES,
} from "@/lib/vision/constants";

export type VisionLocalImage = {
  id: string;
  file: File;
  previewUrl: string;
  fingerprint: string;
};

export type PrepareVisionImageError =
  | "invalid_file_type"
  | "file_too_large"
  | "duplicate";

export type PrepareVisionImageResult =
  | { success: true; image: VisionLocalImage }
  | { success: false; error: PrepareVisionImageError };

function isAllowed(file: File): boolean {
  return (VISION_ALLOWED_MIME as readonly string[]).includes(file.type);
}

export async function prepareVisionImage(
  file: File,
  existingFingerprints: string[] = [],
): Promise<PrepareVisionImageResult> {
  if (!isAllowed(file)) {
    return { success: false, error: "invalid_file_type" };
  }

  const fingerprint = fileFingerprint(file);
  if (existingFingerprints.includes(fingerprint)) {
    return { success: false, error: "duplicate" };
  }

  const compressed = await compressImageFile(file, {
    maxEdge: VISION_MAX_EDGE,
    quality: VISION_COMPRESS_QUALITY,
    preferWebp: true,
  });

  if (compressed.file.size > VISION_MAX_IMAGE_BYTES) {
    return { success: false, error: "file_too_large" };
  }

  const previewUrl = URL.createObjectURL(compressed.file);
  return {
    success: true,
    image: {
      id: `${fingerprint}-${Date.now()}`,
      file: compressed.file,
      previewUrl,
      fingerprint: fileFingerprint(compressed.file),
    },
  };
}

export function revokeVisionPreview(image: VisionLocalImage | null | undefined): void {
  if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
}

export function extractImageFilesFromDataTransfer(
  dataTransfer: DataTransfer | null,
): File[] {
  if (!dataTransfer) return [];
  const files: File[] = [];
  if (dataTransfer.files?.length) {
    for (const file of Array.from(dataTransfer.files)) {
      if (file.type.startsWith("image/")) files.push(file);
    }
  }
  return files;
}

export function extractImageFileFromClipboard(
  clipboardData: DataTransfer | null,
): File | null {
  if (!clipboardData) return null;
  for (const item of Array.from(clipboardData.items ?? [])) {
    if (item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}
