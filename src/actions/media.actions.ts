"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createSignedAttachmentUrl,
  insertMessageAttachment,
  prepareChatUploadSlot,
  renameMessageAttachment,
  setAttachmentPinned,
  softDeleteMessageAttachment,
  attachmentKindForMime,
  isAllowedChatAttachment,
} from "@/lib/chat/attachment-service";
import { insertTextMessage } from "@/lib/chat/message-service";
import { trackChatAnalytics } from "@/lib/chat/analytics";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isFileMediaSharingEnabled } from "@/lib/config/feature-flags";
import {
  listProjectGallery,
  uploadProjectGalleryFile,
} from "@/lib/media/project-gallery";
import { getUserStorageUsage } from "@/lib/media/storage-usage";
import { createSignedMediaUrl } from "@/lib/media/media-object-service";
import type { ProjectGalleryCategory } from "@/lib/media/types";
import { MEDIA_RESTORE_DAYS } from "@/lib/media/mime";

async function assertConversationParticipant(conversationId: string, userId: string) {
  const { assertChatParticipants } = await import("@/domains/chat/authz");
  const { isChatAuthV2Enabled } = await import("@/lib/config/feature-flags");
  if (isChatAuthV2Enabled()) {
    return assertChatParticipants({ conversationId, userId });
  }
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, provider_id, customer_id, service_request_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conv) return { ok: false as const, error: "not_found" as const };
  const { data: providerRow } = await supabase
    .from("providers")
    .select("owner_id")
    .eq("id", conv.provider_id)
    .maybeSingle();
  if (userId !== conv.customer_id && userId !== providerRow?.owner_id) {
    return { ok: false as const, error: "forbidden" as const };
  }
  return {
    ok: true as const,
    serviceRequestId: conv.service_request_id as string | null,
    providerId: conv.provider_id as string,
    customerId: conv.customer_id as string,
    providerOwnerId: (providerRow?.owner_id as string) ?? null,
    chatScope: null as string | null,
    adminUserId: null as string | null,
  };
}

export async function prepareChatMediaUploadAction(input: {
  conversationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, error: "login_required" };
  const gate = await assertConversationParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, error: gate.error };
  if (!isAllowedChatAttachment(input.mimeType)) {
    return { success: false as const, error: "invalid_type" };
  }
  return prepareChatUploadSlot({
    userId: authUser.id,
    conversationId: input.conversationId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
}

export async function finalizeChatMediaUploadAction(input: {
  conversationId: string;
  path: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  bodyText?: string;
  replyToMessageId?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  clientId?: string | null;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, error: "login_required" };
  const gate = await assertConversationParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, error: gate.error };

  const kind = attachmentKindForMime(input.mimeType);
  const messageType =
    kind === "image"
      ? "image"
      : kind === "video"
        ? "video"
        : kind === "voice"
          ? "voice"
          : "document";

  const inserted = await insertTextMessage({
    conversationId: input.conversationId,
    senderId: authUser.id,
    bodyText: input.bodyText?.trim() || input.fileName || " ",
    clientId: input.clientId ?? null,
    messageType,
    replyToMessageId: input.replyToMessageId ?? null,
  });
  if ("error" in inserted) return { success: false as const, error: inserted.error };

  const att = await insertMessageAttachment({
    messageId: inserted.messageId,
    conversationId: input.conversationId,
    uploaderId: authUser.id,
    path: input.path,
    bucket: input.bucket,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    kind,
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
  });

  if (!att.success) return { success: false as const, error: "attach_failed" };

  await trackChatAnalytics({
    eventType: "attachment_sent",
    conversationId: input.conversationId,
    actorId: authUser.id,
    metadata: { kind, sizeBytes: input.sizeBytes },
  });

  revalidatePath(`/messages/${input.conversationId}`);
  revalidatePath(`/business/messages/${input.conversationId}`);
  return {
    success: true as const,
    messageId: inserted.messageId,
    attachmentId: att.attachmentId,
  };
}

export async function renameMediaAttachmentAction(input: {
  attachmentId: string;
  displayName: string;
  conversationId: string;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const ok = await renameMessageAttachment({
    attachmentId: input.attachmentId,
    userId: authUser.id,
    displayName: input.displayName,
  });
  if (ok && isFileMediaSharingEnabled()) {
    void emitAiLearningEvent({
      eventType: "media_file_renamed",
      customerId: authUser.id,
      metadata: { attachmentId: input.attachmentId },
    });
  }
  revalidatePath(`/messages/${input.conversationId}`);
  revalidatePath(`/business/messages/${input.conversationId}`);
  return { success: ok };
}

export async function deleteMediaAttachmentAction(input: {
  attachmentId: string;
  conversationId: string;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const ok = await softDeleteMessageAttachment({
    attachmentId: input.attachmentId,
    userId: authUser.id,
  });
  if (ok && isFileMediaSharingEnabled()) {
    void emitAiLearningEvent({
      eventType: "media_file_deleted",
      customerId: authUser.id,
      metadata: {
        attachmentId: input.attachmentId,
        restoreDays: MEDIA_RESTORE_DAYS,
      },
    });
  }
  revalidatePath(`/messages/${input.conversationId}`);
  revalidatePath(`/business/messages/${input.conversationId}`);
  return { success: ok };
}

export async function pinMediaAttachmentAction(input: {
  attachmentId: string;
  conversationId: string;
  pinned: boolean;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false };
  const gate = await assertConversationParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false };
  const ok = await setAttachmentPinned({
    attachmentId: input.attachmentId,
    userId: authUser.id,
    pinned: input.pinned,
  });
  if (ok && isFileMediaSharingEnabled() && input.pinned) {
    void emitAiLearningEvent({
      eventType: "media_file_pinned",
      customerId: authUser.id,
      metadata: { attachmentId: input.attachmentId },
    });
  }
  revalidatePath(`/messages/${input.conversationId}`);
  revalidatePath(`/business/messages/${input.conversationId}`);
  return { success: ok };
}

export async function trackMediaEventAction(input: {
  event:
    | "media_file_viewed"
    | "media_file_downloaded"
    | "media_preview_opened"
    | "media_voice_played"
    | "media_gallery_viewed";
  conversationId?: string | null;
  projectId?: string | null;
  attachmentId?: string | null;
}) {
  const authUser = await getAuthUser();
  if (!authUser || !isFileMediaSharingEnabled()) return { success: false };
  void emitAiLearningEvent({
    eventType: input.event,
    customerId: authUser.id,
    metadata: {
      conversationId: input.conversationId,
      projectId: input.projectId,
      attachmentId: input.attachmentId,
    },
  });
  return { success: true };
}

export async function getSignedAttachmentUrlAction(input: {
  path: string;
  bucket?: string;
  conversationId: string;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, url: null };
  const gate = await assertConversationParticipant(input.conversationId, authUser.id);
  if (!gate.ok) return { success: false as const, url: null };
  const url = await createSignedAttachmentUrl(
    input.path,
    3600,
    input.bucket ?? "chat-attachments",
  );
  return { success: Boolean(url), url };
}

export async function listProjectGalleryAction(input: {
  projectId: string;
  packageId?: string | null;
  category?: ProjectGalleryCategory | null;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, items: [] };
  const items = await listProjectGallery({
    projectId: input.projectId,
    packageId: input.packageId,
    category: input.category,
    userId: authUser.id,
  });
  return { success: true as const, items };
}

export async function uploadProjectMediaAction(formData: FormData) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, error: "login_required" };
  const projectId = String(formData.get("projectId") ?? "");
  const packageId = String(formData.get("packageId") ?? "") || null;
  const category = (String(formData.get("category") ?? "progress") ||
    "progress") as ProjectGalleryCategory;
  const file = formData.get("file");
  if (!projectId || !(file instanceof File) || file.size <= 0) {
    return { success: false as const, error: "validation_error" };
  }
  const result = await uploadProjectGalleryFile({
    userId: authUser.id,
    projectId,
    packageId,
    category,
    file,
  });
  if (result.success) {
    revalidatePath(`/account/projects/${projectId}`);
  }
  return result;
}

export async function getMyStorageUsageAction() {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  return getUserStorageUsage(authUser.id);
}

export async function copyMediaLinkAction(input: {
  bucket: string;
  path: string;
  conversationId?: string | null;
  projectId?: string | null;
}) {
  const authUser = await getAuthUser();
  if (!authUser) return { success: false as const, url: null };
  if (input.conversationId) {
    const gate = await assertConversationParticipant(input.conversationId, authUser.id);
    if (!gate.ok) return { success: false as const, url: null };
  }
  const url = await createSignedMediaUrl(input.bucket, input.path, 3600);
  return { success: Boolean(url), url };
}
