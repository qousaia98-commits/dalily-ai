/**
 * Sprint 5 Phase 2 — media_objects registry + processing queue enqueue.
 */

import { createClient } from "@/lib/supabase/server";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isFileMediaSharingEnabled } from "@/lib/config/feature-flags";
import type { MediaJobType, MediaKind, MediaProcessingStatus } from "@/lib/media/types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient().then((c) => c as any);
}

export async function registerMediaObject(input: {
  ownerUserId: string;
  bucket: string;
  path: string;
  fileName: string;
  displayName?: string | null;
  mimeType: string;
  sizeBytes: number;
  kind: MediaKind;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  conversationId?: string | null;
  projectId?: string | null;
  packageId?: string | null;
  messageAttachmentId?: string | null;
  projectDocumentId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string } | null> {
  try {
    const supabase = await db();
    const { data, error } = await supabase
      .from("media_objects")
      .insert({
        owner_user_id: input.ownerUserId,
        bucket: input.bucket,
        path: input.path,
        file_name: input.fileName,
        display_name: input.displayName ?? input.fileName,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        kind: input.kind,
        width: input.width ?? null,
        height: input.height ?? null,
        duration_ms: input.durationMs ?? null,
        conversation_id: input.conversationId ?? null,
        project_id: input.projectId ?? null,
        package_id: input.packageId ?? null,
        message_attachment_id: input.messageAttachmentId ?? null,
        project_document_id: input.projectDocumentId ?? null,
        processing_status: "queued",
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single();

    if (error || !data?.id) return null;

    await enqueueMediaJobs(String(data.id), input.kind, input.mimeType);

    if (isFileMediaSharingEnabled()) {
      void emitAiLearningEvent({
        eventType: "media_file_uploaded",
        customerId: input.ownerUserId,
        metadata: {
          mediaId: data.id,
          kind: input.kind,
          sizeBytes: input.sizeBytes,
          mime: input.mimeType,
        },
      });
      void emitAiLearningEvent({
        eventType: "media_processing_queued",
        customerId: input.ownerUserId,
        metadata: { mediaId: data.id },
      });
    }

    return { id: String(data.id) };
  } catch {
    return null;
  }
}

export async function enqueueMediaJobs(
  mediaObjectId: string,
  kind: MediaKind,
  mimeType: string,
): Promise<void> {
  const jobs: MediaJobType[] = ["metadata"];
  if (kind === "image" || mimeType.startsWith("image/")) {
    jobs.push("thumbnail", "ocr_prep", "image_analysis");
  }
  if (kind === "document" && mimeType === "application/pdf") {
    jobs.push("thumbnail", "ocr_prep");
  }
  if (kind === "voice" || kind === "audio" || mimeType.startsWith("audio/")) {
    jobs.push("waveform", "transcription");
  }
  if (kind === "video" || mimeType.startsWith("video/")) {
    jobs.push("thumbnail", "transcription");
  }

  try {
    const supabase = await db();
    await supabase.from("media_processing_jobs").insert(
      jobs.map((job_type) => ({
        media_object_id: mediaObjectId,
        job_type,
        status: "queued",
      })),
    );
    // Mark object ready for UI while AI jobs remain queued (async workers later).
    await supabase
      .from("media_objects")
      .update({
        processing_status: "ready" satisfies MediaProcessingStatus,
        ocr_ready: jobs.includes("ocr_prep"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", mediaObjectId);
  } catch {
    /* fail-soft */
  }
}

export async function createSignedMediaUrl(
  bucket: string,
  path: string,
  expiresInSec = 3600,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data.signedUrl;
}
