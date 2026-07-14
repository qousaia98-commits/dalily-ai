export const PROVIDER_VERIFICATION_BUCKET = "provider-verification";

export const VERIFICATION_DOC_TYPES = ["id_front", "id_back", "selfie"] as const;

export type VerificationDocType = (typeof VERIFICATION_DOC_TYPES)[number];

export const MAX_VERIFICATION_BYTES = 5 * 1024 * 1024;

export const ALLOWED_VERIFICATION_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
