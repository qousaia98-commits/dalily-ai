"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Bucket-agnostic direct-to-Storage PUT via signed upload URL (with progress),
 * falling back to a token-authenticated upload. Shared by any feature that
 * uploads file bytes straight to Supabase Storage instead of through a
 * Server Action.
 */
export async function putFileToStorage(input: {
  bucket: string;
  path: string;
  token?: string;
  signedUrl?: string;
  file: File;
  mimeType: string;
  onPercent: (ratio: number) => void;
}): Promise<{ ok: boolean }> {
  if (input.signedUrl) {
    try {
      await xhrPut(input.signedUrl, input.file, input.mimeType, input.onPercent);
      return { ok: true };
    } catch {
      // fall through
    }
  }

  const supabase = createClient();
  if (input.token) {
    const { error } = await supabase.storage
      .from(input.bucket)
      .uploadToSignedUrl(input.path, input.token, input.file, {
        contentType: input.mimeType,
      });
    if (!error) {
      input.onPercent(1);
      return { ok: true };
    }
  }

  const { error } = await supabase.storage.from(input.bucket).upload(input.path, input.file, {
    contentType: input.mimeType,
    upsert: false,
  });

  if (error) return { ok: false };
  input.onPercent(1);
  return { ok: true };
}

function xhrPut(
  url: string,
  file: File,
  mimeType: string,
  onPercent: (ratio: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onPercent(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`upload_http_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("upload_network"));
    xhr.send(file);
  });
}
