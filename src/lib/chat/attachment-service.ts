import { createClient } from "@/lib/supabase/server";
import type { ChatAttachmentKind } from "@/lib/chat/types";
import {
  CHAT_MEDIA_BUCKET,
  getMaxMediaUploadBytes,
  isAllowedMediaMime,
  mediaKindForMime,
} from "@/lib/media/mime";
import { registerMediaObject } from "@/lib/media/media-object-service";
import { canUploadBytes } from "@/lib/media/storage-usage";

export const CHAT_ATTACHMENTS_BUCKET = CHAT_MEDIA_BUCKET;
/** @deprecated Prefer getMaxMediaUploadBytes() — kept for callers. */
export const CHAT_MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

export function attachmentKindForMime(mime: string): ChatAttachmentKind {
  const kind = mediaKindForMime(mime);
  if (kind === "audio") return "voice";
  return kind as ChatAttachmentKind;
}

export function isAllowedChatAttachment(mime: string): boolean {
  return isAllowedMediaMime(mime);
}

/**
 * Upload a chat attachment to private storage.
 * Compress images on the client before upload. Path: {userId}/{conversationId}/…
 */
export async function uploadChatAttachment(input: {
  userId: string;
  conversationId: string;
  file: File;
}): Promise<
  | {
      success: true;
      path: string;
      bucket: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      kind: ChatAttachmentKind;
    }
  | { success: false; error: "invalid_type" | "too_large" | "quota_exceeded" | "upload_failed" }
> {
  const file = input.file;
  if (!isAllowedChatAttachment(file.type)) {
    return { success: false, error: "invalid_type" };
  }
  const maxBytes = getMaxMediaUploadBytes();
  if (file.size > maxBytes) {
    return { success: false, error: "too_large" };
  }
  if (!(await canUploadBytes(input.userId, file.size))) {
    return { success: false, error: "quota_exceeded" };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file";
  const path = `${input.userId}/${input.conversationId}/${Date.now()}-${safeName}`;
  const supabase = await createClient();

  const { error } = await supabase.storage.from(CHAT_ATTACHMENTS_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { success: false, error: "upload_failed" };

  return {
    success: true,
    path,
    bucket: CHAT_ATTACHMENTS_BUCKET,
    fileName: file.name || safeName,
    mimeType: file.type,
    sizeBytes: file.size,
    kind: attachmentKindForMime(file.type),
  };
}

export async function createSignedAttachmentUrl(
  path: string,
  expiresInSec = 3600,
  bucket: string = CHAT_ATTACHMENTS_BUCKET,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data.signedUrl;
}

export async function insertMessageAttachment(input: {
  messageId: string;
  conversationId: string;
  uploaderId: string;
  path: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: ChatAttachmentKind;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  displayName?: string | null;
}): Promise<{ success: boolean; attachmentId?: string; mediaObjectId?: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("message_attachments")
    .insert({
      message_id: input.messageId,
      conversation_id: input.conversationId,
      uploader_id: input.uploaderId,
      path: input.path,
      bucket: input.bucket,
      file_name: input.fileName,
      display_name: input.displayName ?? input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      kind: input.kind,
      width: input.width ?? null,
      height: input.height ?? null,
      duration_ms: input.durationMs ?? null,
      processing_status: "queued",
    })
    .select("id")
    .single();

  if (error || !data?.id) return { success: false };

  const media = await registerMediaObject({
    ownerUserId: input.uploaderId,
    bucket: input.bucket,
    path: input.path,
    fileName: input.fileName,
    displayName: input.displayName ?? input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    kind: mediaKindForMime(input.mimeType),
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
    conversationId: input.conversationId,
    messageAttachmentId: String(data.id),
  });

  if (media?.id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("message_attachments")
      .update({
        media_object_id: media.id,
        processing_status: "ready",
      })
      .eq("id", data.id);
  }

  return {
    success: true,
    attachmentId: String(data.id),
    mediaObjectId: media?.id,
  };
}

export async function renameMessageAttachment(input: {
  attachmentId: string;
  userId: string;
  displayName: string;
}): Promise<boolean> {
  const name = input.displayName.trim().slice(0, 120);
  if (!name) return false;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from("message_attachments")
    .select("id, uploader_id, media_object_id")
    .eq("id", input.attachmentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row || row.uploader_id !== input.userId) return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("message_attachments")
    .update({ display_name: name })
    .eq("id", input.attachmentId);
  if (error) return false;

  if (row.media_object_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("media_objects")
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq("id", row.media_object_id);
  }
  return true;
}

export async function setAttachmentPinned(input: {
  attachmentId: string;
  userId: string;
  pinned: boolean;
}): Promise<boolean> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("message_attachments")
    .update({
      is_pinned: input.pinned,
      pinned_at: input.pinned ? new Date().toISOString() : null,
      pinned_by: input.pinned ? input.userId : null,
    })
    .eq("id", input.attachmentId)
    .is("deleted_at", null);
  return !error;
}

export async function softDeleteMessageAttachment(input: {
  attachmentId: string;
  userId: string;
}): Promise<boolean> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from("message_attachments")
    .select("id, uploader_id, media_object_id")
    .eq("id", input.attachmentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row || row.uploader_id !== input.userId) return false;

  if (row.media_object_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("soft_delete_media_object", {
      p_media_id: row.media_object_id,
      p_user_id: input.userId,
      p_restore_days: 7,
    });
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("message_attachments")
    .update({
      deleted_at: new Date().toISOString(),
      restore_until: new Date(Date.now() + 7 * 864e5).toISOString(),
    })
    .eq("id", input.attachmentId);
  return !error;
}

export async function prepareChatUploadSlot(input: {
  userId: string;
  conversationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<
  | {
      success: true;
      bucket: string;
      path: string;
      token: string | null;
      signedUrl: string | null;
      maxBytes: number;
    }
  | { success: false; error: string }
> {
  if (!isAllowedChatAttachment(input.mimeType)) {
    return { success: false, error: "invalid_type" };
  }
  const maxBytes = getMaxMediaUploadBytes();
  if (input.sizeBytes > maxBytes) return { success: false, error: "too_large" };
  if (!(await canUploadBytes(input.userId, input.sizeBytes))) {
    return { success: false, error: "quota_exceeded" };
  }

  const safeName =
    input.fileName.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file";
  const path = `${input.userId}/${input.conversationId}/${Date.now()}-${safeName}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return {
      success: true,
      bucket: CHAT_ATTACHMENTS_BUCKET,
      path,
      token: null,
      signedUrl: null,
      maxBytes,
    };
  }

  return {
    success: true,
    bucket: CHAT_ATTACHMENTS_BUCKET,
    path: data.path || path,
    token: data.token ?? null,
    signedUrl: data.signedUrl ?? null,
    maxBytes,
  };
}
