/**
 * Request media attachment helpers (no exported server actions).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/providers/constants";
import {
  MAX_REQUEST_PHOTOS,
  SERVICE_REQUEST_MEDIA_BUCKET,
} from "@/lib/service-requests/constants";
import { buildServiceRequestMediaPath } from "@/lib/service-requests/storage";

export async function uploadServiceRequestPhotos(input: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
  formData: FormData;
  customerId: string;
  requestId: string;
}) {
  const photoFiles = input.formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_REQUEST_PHOTOS);

  for (let i = 0; i < photoFiles.length; i++) {
    const file = photoFiles[i];
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
      )
    ) {
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) continue;

    const path = buildServiceRequestMediaPath(
      input.customerId,
      input.requestId,
      file.name,
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await input.supabase.storage
      .from(SERVICE_REQUEST_MEDIA_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) continue;

    await input.supabase.from("service_request_images").insert({
      request_id: input.requestId,
      bucket: SERVICE_REQUEST_MEDIA_BUCKET,
      path,
      mime_type: file.type,
      size_bytes: file.size,
      sort_order: i,
    });
  }
}
