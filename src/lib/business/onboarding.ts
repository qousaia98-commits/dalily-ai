import type { ManagedProvider } from "@/types/provider.types";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import { getLocalizedField } from "@/types/provider.types";

export type OnboardingPhase = "identity" | "profile" | "success";

export type ProfileStrengthItemId =
  | "identity"
  | "profile"
  | "logo"
  | "gallery"
  | "hours";

export type ProfileStrengthItem = {
  id: ProfileStrengthItemId;
  done: boolean;
};

export type ProfileStrength = {
  items: ProfileStrengthItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
  allDone: boolean;
};

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
  _verification: BusinessVerificationView,
  _locale: string = "ar",
): boolean {
  // Keep drafts / changes-requested in the guided flow until they submit.
  return provider.status === "draft" || provider.status === "changes_requested";
}

export function getProfileStrength(
  provider: ManagedProvider,
  verification: BusinessVerificationView,
  locale: string = "ar",
): ProfileStrength {
  const items: ProfileStrengthItem[] = [
    {
      id: "identity",
      done:
        hasIdentityDocuments(verification) ||
        verification.status === "approved" ||
        provider.verificationStatus === "verified",
    },
    {
      id: "profile",
      done: isBusinessProfileBasicsComplete(provider, locale),
    },
    {
      id: "logo",
      done: Boolean(provider.avatarImageId),
    },
    {
      id: "gallery",
      done: provider.gallery.length >= 3,
    },
    {
      id: "hours",
      done: hasConfiguredOpeningHours(provider),
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  return {
    items,
    completedCount,
    totalCount,
    percent,
    allDone: completedCount === totalCount,
  };
}
