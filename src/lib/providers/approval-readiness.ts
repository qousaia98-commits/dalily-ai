import type { ManagedProvider } from "@/types/provider.types";
import {
  getProviderVerificationForOwner,
  isVerificationComplete,
} from "@/lib/verification/queries";

export type ApprovalReadiness = {
  ready: boolean;
  hasLogo: boolean;
  hasCover: boolean;
  hasGallery: boolean;
  hasIdDocument: boolean;
  missing: Array<"logo" | "cover" | "gallery" | "idDocument">;
};

export function evaluateMediaReadiness(provider: ManagedProvider): Omit<
  ApprovalReadiness,
  "hasIdDocument" | "ready" | "missing"
> & { missingMedia: Array<"logo" | "cover" | "gallery"> } {
  const hasLogo = Boolean(provider.avatarImageId);
  const hasCover = Boolean(provider.coverImageId);
  const hasGallery = provider.gallery.length > 0;
  const missingMedia: Array<"logo" | "cover" | "gallery"> = [];
  if (!hasLogo) missingMedia.push("logo");
  if (!hasCover) missingMedia.push("cover");
  if (!hasGallery) missingMedia.push("gallery");
  return { hasLogo, hasCover, hasGallery, missingMedia };
}

/** Business can submit for admin approval only when logo, cover, gallery, and ID docs are present. */
export async function getApprovalReadiness(
  provider: ManagedProvider,
): Promise<ApprovalReadiness> {
  const media = evaluateMediaReadiness(provider);
  const verification = await getProviderVerificationForOwner(provider.id);
  const hasIdDocument = isVerificationComplete(verification);

  const missing: ApprovalReadiness["missing"] = [...media.missingMedia];
  if (!hasIdDocument) missing.push("idDocument");

  return {
    ready: missing.length === 0,
    hasLogo: media.hasLogo,
    hasCover: media.hasCover,
    hasGallery: media.hasGallery,
    hasIdDocument,
    missing,
  };
}

export function isProviderSubscriptionUnlocked(
  status: ManagedProvider["status"] | string,
): boolean {
  return status === "active";
}
