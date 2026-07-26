import { createHash } from "node:crypto";
import {
  VISION_ALLOWED_MIME,
  VISION_MAX_IMAGE_BYTES,
} from "@/lib/vision/constants";

export type OptimizeVisionImageResult =
  | {
      ok: true;
      bytes: ArrayBuffer;
      mimeType: string;
      byteSize: number;
    }
  | {
      ok: false;
      error: "empty" | "too_large" | "invalid_type";
    };

/**
 * Validate MIME/size. Heavy resize/compress happens client-side.
 */
export function optimizeVisionImage(input: {
  bytes: ArrayBuffer;
  mimeType: string;
}): OptimizeVisionImageResult {
  const mime = (input.mimeType || "image/jpeg").toLowerCase();
  if (!(VISION_ALLOWED_MIME as readonly string[]).includes(mime)) {
    return { ok: false, error: "invalid_type" };
  }
  if (!input.bytes || input.bytes.byteLength === 0) {
    return { ok: false, error: "empty" };
  }
  if (input.bytes.byteLength > VISION_MAX_IMAGE_BYTES) {
    return { ok: false, error: "too_large" };
  }
  return {
    ok: true,
    bytes: input.bytes,
    mimeType: mime,
    byteSize: input.bytes.byteLength,
  };
}

export function contentHashFromBytes(bytes: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

