import { PROVIDER_MEDIA_BUCKET } from "@/lib/providers/constants";

export function getStoragePublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/${PROVIDER_MEDIA_BUCKET}/${path}`;
}

/** Thumbnail via Supabase image transform when available; falls back to public URL. */
export function getStorageThumbnailUrl(path: string, width = 480): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/render/image/public/${PROVIDER_MEDIA_BUCKET}/${path}?width=${width}&resize=contain&quality=75`;
}

export function buildProviderMediaPath(
  ownerId: string,
  providerId: string,
  kind: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${ownerId}/${providerId}/${kind}/${Date.now()}-${safeName}`;
}

/** True when path belongs to this owner/provider/kind (anti-tamper). */
export function isOwnedProviderMediaPath(
  path: string,
  ownerId: string,
  providerId: string,
  kind: string,
): boolean {
  const prefix = `${ownerId}/${providerId}/${kind}/`;
  return path.startsWith(prefix) && !path.includes("..");
}
