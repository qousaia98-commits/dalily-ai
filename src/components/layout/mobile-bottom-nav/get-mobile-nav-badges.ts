import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/session";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { countUnreadConversations } from "@/lib/business/conversations";
import { countPendingRequestsForOwner } from "@/lib/service-requests/queries";
import { loadCustomerConversations } from "@/lib/customer/load-conversations";
import type { MobileNavBadges, MobileNavRole } from "./types";

export async function getMobileNavBadges(role: MobileNavRole): Promise<MobileNavBadges> {
  if (role === "admin") {
    try {
      const admin = createAdminClient();
      const [approvals, changes, payments] = await Promise.all([
        admin
          .from("providers")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_review")
          .is("deleted_at", null),
        admin
          .from("providers")
          .select("id", { count: "exact", head: true })
          .eq("status", "changes_requested")
          .is("deleted_at", null),
        admin
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "pending_review"),
      ]);

      return {
        approvals: (approvals.count ?? 0) + (changes.count ?? 0),
        payments: payments.count ?? 0,
        messages: 0,
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
