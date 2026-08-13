/**
 * Provider-controlled public visibility flags (stored in providers.metadata).
 * Defaults are open for trust-building; providers can tighten privacy.
 */

export type PublicVisibilityFlags = {
  showLogo: boolean;
  showGallery: boolean;
  showCompletedJobs: boolean;
  showServiceArea: boolean;
  showStatistics: boolean;
  showLanguages: boolean;
  showCertificates: boolean;
};

export const DEFAULT_PUBLIC_VISIBILITY: PublicVisibilityFlags = {
  showLogo: true,
  showGallery: true,
  showCompletedJobs: true,
  showServiceArea: true,
  showStatistics: true,
  showLanguages: true,
  showCertificates: true,
};

export function parsePublicVisibility(metadata: unknown): PublicVisibilityFlags {
  if (!metadata || typeof metadata !== "object") {
    return { ...DEFAULT_PUBLIC_VISIBILITY };
  }
  const root = metadata as Record<string, unknown>;
  const raw = (root.public_visibility ?? root.publicVisibility) as
    | Record<string, unknown>
    | undefined;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_PUBLIC_VISIBILITY };
  }

  const bool = (key: string, fallback: boolean) =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : fallback;

  return {
    showLogo: bool("showLogo", DEFAULT_PUBLIC_VISIBILITY.showLogo),
    showGallery: bool("showGallery", DEFAULT_PUBLIC_VISIBILITY.showGallery),
    showCompletedJobs: bool(
      "showCompletedJobs",
      DEFAULT_PUBLIC_VISIBILITY.showCompletedJobs,
    ),
    showServiceArea: bool(
      "showServiceArea",
      DEFAULT_PUBLIC_VISIBILITY.showServiceArea,
    ),
    showStatistics: bool(
      "showStatistics",
      DEFAULT_PUBLIC_VISIBILITY.showStatistics,
    ),
    showLanguages: bool("showLanguages", DEFAULT_PUBLIC_VISIBILITY.showLanguages),
    showCertificates: bool(
      "showCertificates",
      DEFAULT_PUBLIC_VISIBILITY.showCertificates,
    ),
  };
}

/** Merge visibility into existing metadata without wiping other keys. */
export function mergePublicVisibilityIntoMetadata(
  existing: unknown,
  visibility: PublicVisibilityFlags,
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object"
      ? { ...(existing as Record<string, unknown>) }
      : {};
  base.public_visibility = visibility;
  return base;
}
