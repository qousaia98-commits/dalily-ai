import { PROVIDER_MEDIA_BUCKET } from "@/lib/providers/constants";

export function getStoragePublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/${PROVIDER_MEDIA_BUCKET}/${path}`;
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
