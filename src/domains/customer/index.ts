/**
 * SAD Customer domain facade (Sprint 0).
 * @see docs/architecture/sad-boundaries.md
 */

export const CUSTOMER_DOMAIN = {
  service: "customer",
  owns: ["customer_profile", "customer_preferences"],
  impl: ["src/lib/customer"],
  status: "facade",
} as const;

export {
  buildCustomerConversations,
  countUnreadConversations,
  filterConversations,
  findConversation,
  type CustomerConversation,
} from "@/lib/customer/conversations";
