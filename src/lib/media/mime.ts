/**
 * Sprint 5 Phase 2 — MIME allowlist + configurable size limits.
 */

import type { MediaKind } from "@/lib/media/types";

const IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
]);

const DOC = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
]);

const AUDIO_PREFIX = "audio/";
const VIDEO_PREFIX = "video/";

export function mediaKindForMime(mime: string): MediaKind {
  if (IMAGE.has(mime)) return "image";
  if (mime.startsWith(AUDIO_PREFIX)) return mime.includes("webm") || mime.includes("ogg")
    ? "voice"
    : "audio";
  if (mime.startsWith(VIDEO_PREFIX)) return "video";
  if (DOC.has(mime)) return "document";
  return "other";
}

export function isAllowedMediaMime(mime: string): boolean {
  return (
    IMAGE.has(mime) ||
    DOC.has(mime) ||
    mime.startsWith(AUDIO_PREFIX) ||
    mime.startsWith(VIDEO_PREFIX)
  );
}

/** Default 50 MB; override with MEDIA_MAX_UPLOAD_BYTES env (bytes). */
export function getMaxMediaUploadBytes(): number {
  const raw = process.env.MEDIA_MAX_UPLOAD_BYTES?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n > 0) return Math.min(n, 200 * 1024 * 1024);
  }
  return 50 * 1024 * 1024;
}

/** Soft quota per user (default 2 GB). */
export function getMaxUserStorageBytes(): number {
  const raw = process.env.MEDIA_MAX_USER_STORAGE_BYTES?.trim();
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n > 0) return n;
  }
  return 2 * 1024 * 1024 * 1024;
}

export const MEDIA_ACCEPT_ATTR = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".zip",
  "text/plain",
  "text/csv",
  "audio/*",
  "video/*",
].join(",");

export const CHAT_MEDIA_BUCKET = "chat-attachments";
export const PROJECT_MEDIA_BUCKET = "project-media";
export const MEDIA_RESTORE_DAYS = 7;
