/** Sprint 5 Phase 2 — Media collaboration types */

export type MediaKind = "image" | "document" | "voice" | "video" | "audio" | "other";

export type MediaProcessingStatus =
  | "pending"
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "skipped";

export type MediaJobType =
  | "thumbnail"
  | "metadata"
  | "ocr_prep"
  | "image_analysis"
  | "transcription"
  | "waveform";

export type ProjectGalleryCategory =
  | "before"
  | "progress"
  | "completed"
  | "documents"
  | "invoices"
  | "certificates"
  | "other";

export type MediaObject = {
  id: string;
  ownerUserId: string;
  bucket: string;
  path: string;
  fileName: string;
  displayName: string | null;
  mimeType: string;
  sizeBytes: number;
  kind: MediaKind;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  thumbnailPath: string | null;
  conversationId: string | null;
  projectId: string | null;
  packageId: string | null;
  processingStatus: MediaProcessingStatus;
  ocrReady: boolean;
  analysisReady: boolean;
  transcriptionReady: boolean;
  signedUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
};

export type ProjectGalleryItem = {
  id: string;
  projectId: string;
  packageId: string | null;
  kind: string;
  galleryCategory: ProjectGalleryCategory;
  fileName: string | null;
  displayName: string | null;
  mimeType: string | null;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  isPinned: boolean;
  processingStatus: MediaProcessingStatus;
  signedUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
};

export type UserStorageUsage = {
  userId: string;
  bytesUsed: number;
  fileCount: number;
  deletedBytes: number;
  deletedFileCount: number;
  maxBytes: number;
};

export type PendingUploadItem = {
  localId: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "done" | "error" | "cancelled";
  error?: string;
  abort?: AbortController;
};
