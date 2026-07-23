import type { ManagedProvider } from "@/types/provider.types";
import {
  getProviderVerificationForOwner,
  isVerificationComplete,
} from "@/lib/verification/queries";

export type ApprovalReadiness = {
  /** Ready to submit for admin review — identity docs only. */
  ready: boolean;
  hasLogo: boolean;
  hasCover: boolean;
  hasGallery: boolean;
  hasIdDocument: boolean;
  /** Soft media gaps (not required for submit). */
  missingMedia: Array<"logo" | "cover" | "gallery">;
  missing: Array<"idDocument">;
};

export function evaluateMediaReadiness(provider: ManagedProvider): {
  hasLogo: boolean;
  hasCover: boolean;
  hasGallery: boolean;
  missingMedia: Array<"logo" | "cover" | "gallery">;
} {
  const hasLogo = Boolean(provider.avatarImageId);
  const hasCover = Boolean(provider.coverImageId);
  const hasGallery = provider.gallery.length > 0;
  const missingMedia: Array<"logo" | "cover" | "gallery"> = [];
  if (!hasLogo) missingMedia.push("logo");
  if (!hasCover) missingMedia.push("cover");
  if (!hasGallery) missingMedia.push("gallery");
  return { hasLogo, hasCover, hasGallery, missingMedia };
}

/**
 * Business can submit for admin approval when identity documents are complete.
 * Logo, cover, and gallery are optional profile-strength items — not submit blockers.
 */
export async function getApprovalReadiness(
  provider: ManagedProvider,
): Promise<ApprovalReadiness> {
  const media = evaluateMediaReadiness(provider);
  const verification = await getProviderVerificationForOwner(provider.id);
  const hasIdDocument = isVerificationComplete(verification);

  const missing: ApprovalReadiness["missing"] = [];
  if (!hasIdDocument) missing.push("idDocument");

  return {
    ready: missing.length === 0,
    hasLogo: media.hasLogo,
    hasCover: media.hasCover,
    hasGallery: media.hasGallery,
    hasIdDocument,
    missingMedia: media.missingMedia,
    missing,
  };
}

export function isProviderSubscriptionUnlocked(
  status: ManagedProvider["status"] | string,
): boolean {
  return status === "active";
}
