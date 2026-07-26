/**
 * Sprint 5 Phase 2 — project gallery CRUD + signed URLs.
 */

import { createClient } from "@/lib/supabase/server";
import { createSignedMediaUrl, registerMediaObject } from "@/lib/media/media-object-service";
import {
  PROJECT_MEDIA_BUCKET,
  getMaxMediaUploadBytes,
  isAllowedMediaMime,
  mediaKindForMime,
} from "@/lib/media/mime";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import { isFileMediaSharingEnabled } from "@/lib/config/feature-flags";
import type { ProjectGalleryCategory, ProjectGalleryItem } from "@/lib/media/types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient().then((c) => c as any);
}

export async function assertProjectAccess(
  projectId: string,
  userId: string,
): Promise<{ ok: true; customerId: string } | { ok: false }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("service_projects")
    .select("id, customer_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!data) return { ok: false };
  if (data.customer_id === userId) {
    return { ok: true, customerId: String(data.customer_id) };
  }
  // Assigned provider on any package
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pkgs } = await (supabase as any)
    .from("project_packages")
    .select("assigned_provider_id")
    .eq("project_id", projectId);
  const providerIds = ((pkgs ?? []) as Array<{ assigned_provider_id: string | null }>)
    .map((p) => p.assigned_provider_id)
    .filter(Boolean) as string[];
  if (!providerIds.length) return { ok: false };
  const { data: owned } = await supabase
    .from("providers")
    .select("id")
    .eq("owner_id", userId)
    .in("id", providerIds)
    .maybeSingle();
  if (!owned) return { ok: false };
  return { ok: true, customerId: String(data.customer_id) };
}

export async function listProjectGallery(input: {
  projectId: string;
  packageId?: string | null;
  category?: ProjectGalleryCategory | null;
  userId: string;
}): Promise<ProjectGalleryItem[]> {
  const gate = await assertProjectAccess(input.projectId, input.userId);
  if (!gate.ok) return [];

  const supabase = await db();
  let query = supabase
    .from("project_documents")
    .select(
      "id, project_id, package_id, kind, gallery_category, file_name, display_name, mime_type, size_bytes, width, height, duration_ms, is_pinned, processing_status, bucket, storage_path, thumbnail_path, created_at",
    )
    .eq("project_id", input.projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);

  if (input.packageId) query = query.eq("package_id", input.packageId);
  if (input.category) query = query.eq("gallery_category", input.category);

  const { data, error } = await query;
  if (error || !data) return [];

  const items: ProjectGalleryItem[] = [];
  for (const row of data as Array<Record<string, unknown>>) {
    const bucket = String(row.bucket ?? PROJECT_MEDIA_BUCKET);
    const path = String(row.storage_path ?? "");
    const signedUrl = path ? await createSignedMediaUrl(bucket, path) : null;
    const thumb =
      row.thumbnail_path != null
        ? await createSignedMediaUrl(bucket, String(row.thumbnail_path))
        : null;
    items.push({
      id: String(row.id),
      projectId: String(row.project_id),
      packageId: (row.package_id as string | null) ?? null,
      kind: String(row.kind ?? "other"),
      galleryCategory: (row.gallery_category as ProjectGalleryCategory) ?? "other",
      fileName: (row.file_name as string | null) ?? null,
      displayName: (row.display_name as string | null) ?? null,
      mimeType: (row.mime_type as string | null) ?? null,
      sizeBytes: Number(row.size_bytes ?? 0),
      width: (row.width as number | null) ?? null,
      height: (row.height as number | null) ?? null,
      durationMs: (row.duration_ms as number | null) ?? null,
      isPinned: Boolean(row.is_pinned),
      processingStatus: (row.processing_status as ProjectGalleryItem["processingStatus"]) ?? "ready",
      signedUrl,
      thumbnailUrl: thumb,
      createdAt: String(row.created_at),
    });
  }

  if (isFileMediaSharingEnabled() && items.length) {
    void emitAiLearningEvent({
      eventType: "media_gallery_viewed",
      customerId: input.userId,
      metadata: { projectId: input.projectId, count: items.length },
    });
  }

  return items;
}

export async function uploadProjectGalleryFile(input: {
  userId: string;
  projectId: string;
  packageId?: string | null;
  category: ProjectGalleryCategory;
  file: File;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}): Promise<{ success: true; documentId: string } | { success: false; error: string }> {
  const gate = await assertProjectAccess(input.projectId, input.userId);
  if (!gate.ok) return { success: false, error: "forbidden" };
  if (!isAllowedMediaMime(input.file.type)) return { success: false, error: "invalid_type" };
  if (input.file.size > getMaxMediaUploadBytes()) {
    return { success: false, error: "too_large" };
  }

  const kind = mediaKindForMime(input.file.type);
  const safeName =
    input.file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file";
  const path = `${input.userId}/${input.projectId}/${Date.now()}-${safeName}`;
  const supabase = await createClient();

  const { error: upErr } = await supabase.storage
    .from(PROJECT_MEDIA_BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false });
  if (upErr) return { success: false, error: "upload_failed" };

  const docKind =
    kind === "image"
      ? "photo"
      : kind === "video"
        ? "video"
        : kind === "audio" || kind === "voice"
          ? "audio"
          : input.category === "invoices"
            ? "invoice"
            : input.category === "certificates"
              ? "certificate"
              : "document";

  const admin = await db();
  const { data: doc, error } = await admin
    .from("project_documents")
    .insert({
      project_id: input.projectId,
      package_id: input.packageId ?? null,
      kind: docKind,
      gallery_category: input.category,
      storage_path: path,
      bucket: PROJECT_MEDIA_BUCKET,
      file_name: input.file.name || safeName,
      display_name: input.file.name || safeName,
      mime_type: input.file.type,
      size_bytes: input.file.size,
      width: input.width ?? null,
      height: input.height ?? null,
      duration_ms: input.durationMs ?? null,
      uploaded_by: input.userId,
      processing_status: "queued",
    })
    .select("id")
    .single();

  if (error || !doc?.id) return { success: false, error: "db_failed" };

  const media = await registerMediaObject({
    ownerUserId: input.userId,
    bucket: PROJECT_MEDIA_BUCKET,
    path,
    fileName: input.file.name || safeName,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    kind,
    width: input.width,
    height: input.height,
    durationMs: input.durationMs,
    projectId: input.projectId,
    packageId: input.packageId,
    projectDocumentId: String(doc.id),
  });

  if (media?.id) {
    await admin
      .from("project_documents")
      .update({ media_object_id: media.id, processing_status: "ready" })
      .eq("id", doc.id);
  }

  if (isFileMediaSharingEnabled()) {
    void emitAiLearningEvent({
      eventType: "media_project_shared",
      customerId: input.userId,
      metadata: {
        projectId: input.projectId,
        category: input.category,
        documentId: doc.id,
      },
    });
  }

  return { success: true, documentId: String(doc.id) };
}
