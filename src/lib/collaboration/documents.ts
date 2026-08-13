/**
 * Sprint 5 Phase 5 — document category + version history helpers.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logProjectActivity } from "./activity";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export type DocumentCategory =
  | "invoice"
  | "contract"
  | "certificate"
  | "manual"
  | "guarantee"
  | "signed"
  | "other";

export async function setDocumentCategory(input: {
  projectId: string;
  documentId: string;
  category: DocumentCategory;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { error } = await db()
      .from("project_documents")
      .update({ doc_category: input.category })
      .eq("id", input.documentId)
      .eq("project_id", input.projectId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "update_failed" };
  }
}

export async function addDocumentVersion(input: {
  projectId: string;
  documentId: string;
  storagePath: string;
  bucket?: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number;
  changeNote?: string | null;
  uploadedBy?: string | null;
}): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  try {
    const { data: doc } = await db()
      .from("project_documents")
      .select("id, current_version, storage_path, file_name")
      .eq("id", input.documentId)
      .eq("project_id", input.projectId)
      .maybeSingle();

    if (!doc) return { ok: false, error: "document_not_found" };

    const nextVersion = Number(doc.current_version ?? 1) + 1;

    const { error: vErr } = await db().from("project_document_versions").insert({
      document_id: input.documentId,
      project_id: input.projectId,
      version_number: nextVersion,
      storage_path: input.storagePath,
      bucket: input.bucket ?? "project-media",
      file_name: input.fileName ?? doc.file_name,
      mime_type: input.mimeType ?? null,
      size_bytes: input.sizeBytes ?? 0,
      change_note: input.changeNote ?? null,
      uploaded_by: input.uploadedBy ?? null,
    });

    if (vErr) return { ok: false, error: vErr.message };

    await db()
      .from("project_documents")
      .update({
        storage_path: input.storagePath,
        current_version: nextVersion,
        file_name: input.fileName ?? doc.file_name,
      })
      .eq("id", input.documentId);

    await logProjectActivity({
      projectId: input.projectId,
      eventKey: "document_versioned",
      labelEn: `Document updated (v${nextVersion})`,
      labelAr: `تم تحديث المستند (نسخة ${nextVersion})`,
      actor: "customer",
      actorUserId: input.uploadedBy,
      payload: { documentId: input.documentId, version: nextVersion },
    });

    return { ok: true, version: nextVersion };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "version_failed" };
  }
}

export async function listDocumentVersions(input: {
  projectId: string;
  documentId: string;
}): Promise<
  Array<{
    id: string;
    versionNumber: number;
    fileName: string | null;
    storagePath: string;
    changeNote: string | null;
    createdAt: string;
  }>
> {
  try {
    const { data } = await db()
      .from("project_document_versions")
      .select("*")
      .eq("project_id", input.projectId)
      .eq("document_id", input.documentId)
      .order("version_number", { ascending: false });

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      versionNumber: Number(row.version_number),
      fileName: row.file_name ? String(row.file_name) : null,
      storagePath: String(row.storage_path),
      changeNote: row.change_note ? String(row.change_note) : null,
      createdAt: String(row.created_at),
    }));
  } catch {
    return [];
  }
}
