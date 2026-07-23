/**
 * Shared owner-prefixed Storage path scheme, reused by any bucket that keys
 * objects as `${ownerId}/${providerId}/${segment}/${timestamp}-${fileName}`
 * (provider media, payment receipts, ...). Domain modules keep their own
 * named wrappers for call-site clarity; this holds the one implementation.
 */

export function buildOwnedStoragePath(
  ownerId: string,
  providerId: string,
  segment: string,
  fileName: string,
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${ownerId}/${providerId}/${segment}/${Date.now()}-${safeName}`;
}

/** True when path belongs to this owner/provider/segment (anti-tamper). */
export function isOwnedStoragePath(
  path: string,
  ownerId: string,
  providerId: string,
  segment: string,
): boolean {
  const prefix = `${ownerId}/${providerId}/${segment}/`;
  return path.startsWith(prefix) && !path.includes("..");
}
