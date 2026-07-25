/**
 * SAD Media domain facade (Sprint 0).
 */

export const MEDIA_DOMAIN = {
  service: "media",
  owns: ["media_objects", "acl_metadata"],
  impl: ["src/lib/media", "src/lib/storage"],
  status: "facade",
} as const;

export {
  compressImageFile,
  prepareVerificationImage,
  fileFingerprint,
  type CompressImageOptions,
  type CompressImageResult,
} from "@/lib/media/compress-image";

export { buildOwnedStoragePath, isOwnedStoragePath } from "@/lib/storage/owned-path";
