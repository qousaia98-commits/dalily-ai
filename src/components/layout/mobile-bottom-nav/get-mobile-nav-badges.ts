import { getAuthUser } from "@/lib/auth/session";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { countUnreadConversations } from "@/lib/business/conversations";
import { countPendingRequestsForOwner } from "@/lib/service-requests/queries";
import { loadCustomerConversations } from "@/lib/customer/load-conversations";
import { getAdminUnreadBadgeCounts } from "@/lib/admin/nav-badges";
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
      if (!authUser) return { messages: 0, requests: 0 };
      const [{ conversations }, pendingRequests] = await Promise.all([
        loadBusinessConversations(authUser.id),
        countPendingRequestsForOwner(authUser.id),
      ]);
      return {
        messages: countUnreadConversations(conversations),
        requests: pendingRequests,
      };
    } catch {
      return { messages: 0, requests: 0 };
    }
  }

  if (role === "guest") {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { messages: 0 };
      const { conversations } = await loadCustomerConversations(authUser.id);
      return { messages: countUnreadConversations(conversations) };
    } catch {
      return { messages: 0 };
    }
  }

  return {};
}
