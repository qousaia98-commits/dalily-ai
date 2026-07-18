import type { PlanSlug } from "@/lib/subscription/types";
import type { ProviderStatus } from "@/types/database.types";

export type BusinessNotificationSource = "dalily" | "customer" | "admin";

export type BusinessNotification = {
  id: string;
  source: BusinessNotificationSource;
  icon: "check" | "alert" | "payment" | "star" | "crown" | "shield" | "message" | "review" | "clock";
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  createdAt: string;
  /** Server-side "needs attention" — drives unread badges. */
  unread: boolean;
  href?: string;
};

type BuildInput = {
  providerStatus: ProviderStatus | string;
  verificationStatus: string;
  planSlug: PlanSlug;
  subscriptionStatus: string;
  adminReviewNote?: string | null;
  changesRequestedAt?: string | null;
  pendingReviewPayment?: {
    id: string;
    planLabel: string;
    submittedAt: string | null;
  } | null;
  recentlyPaid?: {
    id: string;
    planLabel: string;
    approvedAt: string | null;
  } | null;
  expiresAt?: string | null;
  reviewCount?: number;
};

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return ms / (1000 * 60 * 60);
}

/**
 * Actionable Dalily inbox items only — no permanent filler notifications.
 */
export function buildBusinessNotifications(input: BuildInput): BusinessNotification[] {
  const items: BusinessNotification[] = [];
  const now = new Date().toISOString();

  if (input.providerStatus === "changes_requested") {
    items.push({
      id: "admin_changes_requested",
      source: "admin",
      icon: "alert",
      titleKey: "changesRequested.title",
      bodyKey: input.adminReviewNote ? "changesRequested.bodyWithNote" : "changesRequested.body",
      bodyParams: input.adminReviewNote
        ? { note: input.adminReviewNote.slice(0, 120) }
        : undefined,
      createdAt: input.changesRequestedAt ?? now,
      unread: true,
      href: "/business/verification",
    });
  }

  if (input.pendingReviewPayment) {
    items.push({
      id: `payment_review_${input.pendingReviewPayment.id}`,
      source: "dalily",
      icon: "payment",
      titleKey: "paymentReceived.title",
      bodyKey: "paymentReceived.body",
      bodyParams: { plan: input.pendingReviewPayment.planLabel },
      createdAt: input.pendingReviewPayment.submittedAt ?? now,
      unread: true,
      href: "/business/subscription",
    });
  }

  const paidHours = hoursSince(input.recentlyPaid?.approvedAt);
  if (input.recentlyPaid && paidHours != null && paidHours < 24) {
    const isPremium = input.planSlug === "premium";
    items.push({
      id: `plan_activated_${input.recentlyPaid.id}`,
      source: "dalily",
      icon: isPremium ? "crown" : "star",
      titleKey: isPremium ? "premiumActivated.title" : "proActivated.title",
      bodyKey: isPremium ? "premiumActivated.body" : "proActivated.body",
      createdAt: input.recentlyPaid.approvedAt ?? now,
      unread: true,
      href: "/business/subscription",
    });
  }

  if (input.expiresAt) {
    const hoursLeft = (new Date(input.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursLeft > 0 && hoursLeft < 24 * 7 && input.planSlug !== "free") {
      items.push({
        id: `sub_expiring_${input.expiresAt}`,
        source: "dalily",
        icon: "clock",
        titleKey: "subscriptionExpiring.title",
        bodyKey: "subscriptionExpiring.body",
        createdAt: now,
        unread: true,
        href: "/business/subscription",
      });
    }
  }

  if (input.providerStatus === "pending_review") {
    items.push({
      id: "system_pending_review",
      source: "dalily",
      icon: "clock",
      titleKey: "businessPending.title",
      bodyKey: "businessPending.body",
      createdAt: now,
      unread: false,
      href: "/business",
    });
  }

  // Deduplicate by id (keep newest)
  const byId = new Map<string, BusinessNotification>();
  for (const item of items) {
    const prev = byId.get(item.id);
    if (!prev || new Date(item.createdAt) > new Date(prev.createdAt)) {
      byId.set(item.id, item);
    }
  }

  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function countUnreadBusinessNotifications(
  items: BusinessNotification[],
): number {
  return items.filter((item) => item.unread).length;
}
