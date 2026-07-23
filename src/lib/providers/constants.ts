export const PROVIDER_MEDIA_BUCKET = "provider-media";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Absolute gallery cap across all plans (plan limits may be lower). */
export const MAX_GALLERY_IMAGES = 20;
