import { getAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { countUnreadConversations } from "@/lib/business/conversations";
import {
  getUnreadOrderNotificationCount,
  getUnreadOpportunityNotificationCount,
  getUnreadUnlockNotificationCount,
  getUnreadVerificationNotificationCount,
} from "@/lib/orders/notifications";
import { isOffersV2Enabled, isUnlockV2Enabled } from "@/lib/config/feature-flags";
import { getAdminUnreadBadgeCounts } from "@/lib/admin/nav-badges";
import { loadCustomerConversations } from "@/lib/customer/load-conversations";
import type {
  AdminNavBadges,
  CustomerNavBadges,
  ProviderNavBadges,
} from "@/lib/badges/format";
import { clampBadgeCount } from "@/lib/badges/format";

/**
 * Provider nav badges — unread marketplace notifications per channel + messages.
 * Counts are read-state based (clear when the related page is opened).
 */
export async function getProviderNavBadges(userId: string): Promise<ProviderNavBadges> {
  const empty: ProviderNavBadges = {
    messages: 0,
    orders: 0,
    opportunities: 0,
    unlock: 0,
    verification: 0,
    requests: 0,
  };

  try {
    const provider = await getOwnedProvider(userId);
    if (!provider) return empty;

    const [{ conversations }, orders, verification, opportunityUnread, unlockUnread] =
      await Promise.all([
        loadBusinessConversations(userId),
        getUnreadOrderNotificationCount(userId),
        getUnreadVerificationNotificationCount(userId),
        isOffersV2Enabled()
          ? getUnreadOpportunityNotificationCount(userId)
          : Promise.resolve(0),
        isUnlockV2Enabled()
          ? getUnreadUnlockNotificationCount(userId)
          : Promise.resolve(0),
      ]);

    const messages = countUnreadConversations(conversations);
    const orderCount = clampBadgeCount(orders);

    return {
      messages: clampBadgeCount(messages),
      orders: orderCount,
      opportunities: clampBadgeCount(opportunityUnread),
      unlock: clampBadgeCount(unlockUnread),
      verification: clampBadgeCount(verification),
      requests: orderCount,
    };
  } catch {
    return empty;
  }
}

export async function getCustomerNavBadges(userId: string): Promise<CustomerNavBadges> {
  try {
    const [{ conversations }, orders] = await Promise.all([
      loadCustomerConversations(userId),
      getUnreadOrderNotificationCount(userId),
    ]);
    return {
      messages: clampBadgeCount(countUnreadConversations(conversations)),
      orders: clampBadgeCount(orders),
    };
  } catch {
    return { messages: 0, orders: 0 };
  }
}

export async function getAdminNavBadges(): Promise<AdminNavBadges> {
  try {
    const counts = await getAdminUnreadBadgeCounts();
    return {
      approvals: clampBadgeCount(counts.approvals ?? counts.businesses ?? 0),
      payments: clampBadgeCount(counts.payments ?? 0),
      issues: clampBadgeCount(counts.issues ?? 0),
      messages: clampBadgeCount(counts.messages ?? 0),
    };
  } catch {
    return { approvals: 0, payments: 0, issues: 0, messages: 0 };
  }
}

/** Convenience for layouts that already have auth. */
export async function getNavBadgesForCurrentUser(
  role: "business" | "customer" | "admin" | "guest",
): Promise<Partial<ProviderNavBadges & CustomerNavBadges & AdminNavBadges>> {
  if (role === "guest") return {};
  if (role === "admin") return getAdminNavBadges();
  const auth = await getAuthUser();
  if (!auth) return {};
  if (role === "business") return getProviderNavBadges(auth.id);
  return getCustomerNavBadges(auth.id);
}
