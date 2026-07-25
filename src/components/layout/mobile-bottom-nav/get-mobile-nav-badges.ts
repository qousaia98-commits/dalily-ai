import { getAuthUser } from "@/lib/auth/session";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { countUnreadConversations } from "@/lib/business/conversations";
import { loadCustomerConversations } from "@/lib/customer/load-conversations";
import { getAdminUnreadBadgeCounts } from "@/lib/admin/nav-badges";
import { getUnreadOrderNotificationCount } from "@/lib/orders/notifications";
import type { MobileNavBadges, MobileNavRole } from "./types";

export async function getMobileNavBadges(role: MobileNavRole): Promise<MobileNavBadges> {
  if (role === "admin") {
    try {
      const counts = await getAdminUnreadBadgeCounts();
      return {
        approvals: counts.approvals ?? counts.businesses ?? 0,
        payments: counts.payments ?? 0,
      };
    } catch {
      return {};
    }
  }

  if (role === "business") {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { messages: 0, orders: 0 };
      const [{ conversations }, orders] = await Promise.all([
        loadBusinessConversations(authUser.id),
        getUnreadOrderNotificationCount(authUser.id),
      ]);
      return {
        messages: countUnreadConversations(conversations),
        orders,
        requests: orders,
      };
    } catch {
      return { messages: 0, orders: 0 };
    }
  }

  if (role === "guest" || role === "customer") {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { messages: 0, orders: 0 };
      const [{ conversations }, orders] = await Promise.all([
        loadCustomerConversations(authUser.id),
        getUnreadOrderNotificationCount(authUser.id),
      ]);
      return {
        messages: countUnreadConversations(conversations),
        orders,
      };
    } catch {
      return { messages: 0, orders: 0 };
    }
  }

  return {};
}
