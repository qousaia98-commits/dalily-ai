import type { ManagedProvider } from "@/types/provider.types";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import { getLocalizedField } from "@/types/provider.types";

export type OnboardingPhase = "identity" | "profile" | "success";

function hasLocalizedText(
  value: { ar?: string; en?: string } | null | undefined,
): boolean {
  if (!value) return false;
  return Boolean(value.ar?.trim() || value.en?.trim());
}

export function hasIdentityDocuments(verification: BusinessVerificationView): boolean {
  return (
    verification.idFrontUploaded &&
    verification.idBackUploaded &&
    verification.selfieUploaded
  );
}

/** Required onboarding profile fields — logo/gallery/hours excluded. */
export function isBusinessProfileBasicsComplete(
  provider: ManagedProvider,
  locale: string = "ar",
): boolean {
  const name = getLocalizedField(provider.name, locale as "ar" | "en").trim();
  const about = getLocalizedField(provider.about, locale as "ar" | "en").trim();
  const address = hasLocalizedText(provider.addressLine);
  const phone = Boolean(provider.phone?.trim());
  const category = Boolean(provider.categoryId);
  const city = Boolean(provider.cityId);

  return (
    name.length >= 2 &&
    about.length >= 10 &&
    phone &&
    category &&
    city &&
    address
  );
}

export function hasConfiguredOpeningHours(provider: ManagedProvider): boolean {
  const configured = provider.workingHours.filter(
    (h) => h.isClosed || (Boolean(h.opensAt) && Boolean(h.closesAt)),
  );
  return configured.length >= 5;
}

export function resolveOnboardingPhase(
  provider: ManagedProvider,
  verification: BusinessVerificationView,
  locale: string = "ar",
): OnboardingPhase {
  if (
    provider.status === "pending_review" ||
    provider.status === "active" ||
    verification.status === "approved"
  ) {
    return "success";
  }

  if (!hasIdentityDocuments(verification)) {
    return "identity";
  }

  if (!isBusinessProfileBasicsComplete(provider, locale)) {
    return "profile";
  }

  // Docs + profile ready but not yet submitted — finish on the profile step.
  if (provider.status === "draft" || provider.status === "changes_requested") {
    return "profile";
  }

  return "success";
}

export function shouldForceOnboarding(
  provider: ManagedProvider,
): boolean {
  // Only incomplete drafts are gently guided — never changes_requested / rejection loops.
  // After rejection, providers stay on dashboard/verification (Sprint 44 resubmission).
  // Session "Later" defer is checked by the caller via cookie.
  if (provider.status !== "draft") return false;
  if (provider.verificationStatus === "rejected") return false;
  return true;
}

/** True when the provider has not started identity docs yet (show calm welcome first). */
export function shouldShowWelcomeLanding(
  provider: ManagedProvider,
  verification: BusinessVerificationView,
): boolean {
  if (provider.status === "active" || provider.status === "pending_review") return false;
  if (verification.status === "approved" || verification.status === "pending") return false;
  return !hasIdentityDocuments(verification);
}
