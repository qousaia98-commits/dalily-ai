import { createClient } from "@/lib/supabase/server";
import type { ChatAttachmentKind } from "@/lib/chat/types";

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";
export const CHAT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const DOC_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

export function attachmentKindForMime(mime: string): ChatAttachmentKind {
  if (IMAGE_TYPES.has(mime)) return "image";
  if (mime.startsWith("audio/")) return "voice";
  if (mime.startsWith("video/")) return "video";
  if (DOC_TYPES.has(mime)) return "document";
  return "other";
}

export function isAllowedChatAttachment(mime: string): boolean {
  return (
    IMAGE_TYPES.has(mime) ||
    DOC_TYPES.has(mime) ||
    mime.startsWith("audio/") ||
    mime.startsWith("video/")
  );
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
  | { success: false; error: "invalid_type" | "too_large" | "upload_failed" }
> {
  const file = input.file;
  if (!isAllowedChatAttachment(file.type)) {
    return { success: false, error: "invalid_type" };
  }
  if (file.size > CHAT_MAX_ATTACHMENT_BYTES) {
    return { success: false, error: "too_large" };
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
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
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
}): Promise<{ success: boolean }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("message_attachments").insert({
    message_id: input.messageId,
    conversation_id: input.conversationId,
    uploader_id: input.uploaderId,
    path: input.path,
    bucket: input.bucket,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    kind: input.kind,
  });
  return { success: !error };
}
