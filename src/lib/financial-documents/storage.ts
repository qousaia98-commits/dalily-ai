/**
 * Storage helpers for generated financial PDFs.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export const FINANCIAL_DOCUMENTS_BUCKET = "financial-documents";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export function buildDocumentStoragePath(input: {
  providerId: string;
  documentId: string;
  documentNumber: string;
}): string {
  const safe = input.documentNumber.replace(/[^A-Za-z0-9_-]/g, "_");
  return `${input.providerId}/${input.documentId}/${safe}.pdf`;
}

export async function uploadDocumentPdf(input: {
  path: string;
  bytes: Buffer;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(FINANCIAL_DOCUMENTS_BUCKET)
    .upload(input.path, input.bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function createDocumentSignedUrl(
  path: string,
  expiresIn = 120,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(FINANCIAL_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function logDocumentDownload(input: {
  documentId: string;
  actorUserId?: string | null;
  actorRole?: string | null;
}): Promise<void> {
  try {
    await db().from("document_download_history").insert({
      document_id: input.documentId,
      actor_user_id: input.actorUserId ?? null,
      actor_role: input.actorRole ?? null,
    });
  } catch {
    // soft
  }
}
