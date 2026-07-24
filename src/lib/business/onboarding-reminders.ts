/**
 * Soft onboarding reminder engine — encouragement only.
 * Stops when verified. Respects dismiss cooldowns.
 */

import type { ManagedProvider } from "@/types/provider.types";
import type { BusinessVerificationView } from "@/lib/verification/queries";
import {
  daysSince,
  isCooldownActive,
  resolveReminderTier,
  type ReminderTier,
} from "@/lib/business/onboarding-preference";
import { isBusinessProfileBasicsComplete } from "@/lib/business/onboarding";

export type OnboardingReminderCopyId =
  | "day3"
  | "day7"
  | "day14"
  | "day30"
  | "incomplete";

export type OnboardingReminderState = {
  showDashboardCard: boolean;
  showProfileWidgetEmphasis: boolean;
  activeTier: ReminderTier[];
  copyId: OnboardingReminderCopyId;
  verified: boolean;
};

export function isProviderVerified(
  provider: ManagedProvider,
  verification: BusinessVerificationView,
): boolean {
  return (
    provider.verificationStatus === "verified" ||
    verification.status === "approved"
  );
}

export function getOnboardingReminderState(input: {
  provider: ManagedProvider;
  verification: BusinessVerificationView;
  cardDismissedAt: number | null;
  reminderDismissedAt: number | null;
  locale?: string;
}): OnboardingReminderState {
  const verified = isProviderVerified(input.provider, input.verification);
  if (verified) {
    return {
      showDashboardCard: false,
      showProfileWidgetEmphasis: false,
      activeTier: [],
      copyId: "incomplete",
      verified: true,
    };
  }

  // Already submitted — wait calmly; no nagging while under review.
  if (
    input.verification.status === "pending" ||
    input.provider.status === "pending_review"
  ) {
    return {
      showDashboardCard: false,
      showProfileWidgetEmphasis: false,
      activeTier: [],
      copyId: "incomplete",
      verified: false,
    };
  }

  const days = daysSince(input.provider.createdAt);
  const activeTier = resolveReminderTier(days);
  const cardCooling = isCooldownActive(input.cardDismissedAt);
  const reminderCooling = isCooldownActive(input.reminderDismissedAt);

  const basicsDone = isBusinessProfileBasicsComplete(
    input.provider,
    input.locale ?? "ar",
  );

  let copyId: OnboardingReminderCopyId = "incomplete";
  if (days >= 30) copyId = "day30";
  else if (days >= 14) copyId = "day14";
  else if (days >= 7) copyId = "day7";
  else if (days >= 3) copyId = "day3";

  const needsEncouragement =
    !basicsDone ||
    input.provider.status === "draft" ||
    input.provider.status === "changes_requested" ||
    input.verification.status === "rejected" ||
    input.verification.status === null;

  return {
    showDashboardCard: needsEncouragement && !cardCooling,
    showProfileWidgetEmphasis: needsEncouragement && !reminderCooling,
    activeTier,
    copyId,
    verified: false,
  };
}

/** Architecture stub — future scheduled marketplace notifications. */
export function listOnboardingNotificationSchedules(): Array<{
  day: ReminderTier;
  titleKey: string;
  bodyKey: string;
}> {
  return [
    {
      day: 3,
      titleKey: "business.onboarding.reminders.day3.title",
      bodyKey: "business.onboarding.reminders.day3.body",
    },
    {
      day: 7,
      titleKey: "business.onboarding.reminders.day7.title",
      bodyKey: "business.onboarding.reminders.day7.body",
    },
    {
      day: 14,
      titleKey: "business.onboarding.reminders.day14.title",
      bodyKey: "business.onboarding.reminders.day14.body",
    },
    {
      day: 30,
      titleKey: "business.onboarding.reminders.day30.title",
      bodyKey: "business.onboarding.reminders.day30.body",
    },
  ];
}
