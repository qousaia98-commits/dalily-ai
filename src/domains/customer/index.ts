/**
 * SAD Customer domain (Sprint 2 extends intent publish path).
 */

export const CUSTOMER_DOMAIN = {
  service: "customer",
  owns: ["customer_profile", "customer_preferences", "intent_publish_commands"],
  impl: ["src/lib/customer", "src/domains/customer"],
  status: "facade_plus_intent",
  sprint: 2,
} as const;

export {
  buildCustomerConversations,
  countUnreadConversations,
  filterConversations,
  findConversation,
  type CustomerConversation,
} from "@/lib/customer/conversations";

export type {
  IntentUrgency,
  CategorySuggestion,
  PublishIntentInput,
} from "@/domains/customer/intent-types";

export { suggestCategoryFromIntent } from "@/domains/customer/suggest-category";
export { publishIntentRequest } from "@/domains/customer/publish-intent";
export { isCustomerIntentFlowV2Enabled } from "@/lib/config/feature-flags";
