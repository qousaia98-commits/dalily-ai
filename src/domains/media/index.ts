/**
 * SAD Media domain facade (Sprint 0 + Sprint 5 Phase 2).
 */

export const MEDIA_DOMAIN = {
  service: "media",
  owns: ["media_objects", "media_processing_jobs", "user_storage_usage", "acl_metadata"],
  impl: ["src/lib/media", "src/lib/storage", "src/lib/chat/attachment-service"],
  status: "active",
} as const;

export {
  compressImageFile,
  prepareVerificationImage,
  fileFingerprint,
  type CompressImageOptions,
  type CompressImageResult,
} from "@/lib/media/compress-image";

export { buildOwnedStoragePath, isOwnedStoragePath } from "@/lib/storage/owned-path";

export {
  MEDIA_ACCEPT_ATTR,
  CHAT_MEDIA_BUCKET,
  PROJECT_MEDIA_BUCKET,
  getMaxMediaUploadBytes,
  getMaxUserStorageBytes,
  isAllowedMediaMime,
  mediaKindForMime,
} from "@/lib/media/mime";

export type {
  MediaObject,
  MediaKind,
  ProjectGalleryItem,
  ProjectGalleryCategory,
  UserStorageUsage,
} from "@/lib/media/types";

export { registerMediaObject, createSignedMediaUrl } from "@/lib/media/media-object-service";
export { listProjectGallery, uploadProjectGalleryFile } from "@/lib/media/project-gallery";
export { getUserStorageUsage } from "@/lib/media/storage-usage";
