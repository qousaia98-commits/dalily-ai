import { createAdminClient } from "@/lib/supabase/admin";
import type { MobileNavBadges, MobileNavRole } from "./types";

export async function getMobileNavBadges(role: MobileNavRole): Promise<MobileNavBadges> {
  if (role === "admin") {
    try {
      const admin = createAdminClient();
      const [approvals, payments] = await Promise.all([
        admin
          .from("providers")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending_review")
          .is("deleted_at", null),
        admin
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "pending_review"),
      ]);

      return {
        approvals: approvals.count ?? 0,
        payments: payments.count ?? 0,
        messages: 0,
      };
    } catch {
      return {};
    }
  }

  if (role === "business") {
    // Messaging is not live yet — hide badges until unread counts exist.
    return { messages: 0 };
  }

  return {};
}
