import { getAuthUser } from "@/lib/auth/session";
import {
  getAdminNavBadges,
  getCustomerNavBadges,
  getProviderNavBadges,
} from "@/lib/badges";
import type { MobileNavBadges, MobileNavRole } from "./types";

/**
 * Mobile nav badges — reuses shared badge counters for all roles.
 */
export async function getMobileNavBadges(role: MobileNavRole): Promise<MobileNavBadges> {
  if (role === "admin") {
    try {
      const counts = await getAdminNavBadges();
      return {
        approvals: counts.approvals,
        payments: counts.payments,
        issues: counts.issues,
        messages: counts.messages,
      };
    } catch {
      return {};
    }
  }

  if (role === "business") {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { messages: 0, orders: 0, opportunities: 0 };
      const badges = await getProviderNavBadges(authUser.id);
      return {
        messages: badges.messages,
        orders: badges.orders,
        opportunities: badges.opportunities,
        requests: badges.requests,
        unlock: badges.unlock,
        verification: badges.verification,
      };
    } catch {
      return { messages: 0, orders: 0, opportunities: 0 };
    }
  }

  if (role === "guest" || role === "customer") {
    try {
      const authUser = await getAuthUser();
      if (!authUser) return { messages: 0, orders: 0 };
      const badges = await getCustomerNavBadges(authUser.id);
      return {
        messages: badges.messages,
        orders: badges.orders,
      };
    } catch {
      return { messages: 0, orders: 0 };
    }
  }

  return {};
}
