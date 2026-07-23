/** Sprint 35 — Vision Engine constants (client + server safe). */

export const VISION_MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB after client compress
export const VISION_MAX_EDGE = 1280;
export const VISION_COMPRESS_QUALITY = 0.78;
export const VISION_REQUEST_TIMEOUT_MS = 20_000;

export const VISION_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type VisionAllowedMime = (typeof VISION_ALLOWED_MIME)[number];

/** Confidence threshold to skip Diagnosis Wizard when urgency is known. */
export const VISION_SKIP_DIAGNOSIS_CONFIDENCE = "high" as const;

export const VISION_SERVICE_CATEGORIES = [
  "electrician",
  "plumber",
  "mechanic",
  "appliance_repair",
  "locksmith",
  "unsupported",
] as const;
