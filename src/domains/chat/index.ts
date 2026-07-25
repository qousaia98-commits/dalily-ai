/**
 * SAD Chat domain — grant-gated full chat (Sprint 7).
 * Pre-unlock Q&A remains offer_clarifications (Offer domain).
 */

export const CHAT_DOMAIN = {
  service: "chat",
  owns: ["threads", "messages", "qa_items"],
  impl: ["src/domains/chat", "src/lib/chat", "src/lib/messaging"],
  status: "active",
  sprint: 7,
  featureFlag: "CHAT_AUTH_V2",
} as const;

export type * from "@/lib/chat/types";

export {
  canAccessFullChat,
  assertChatParticipants,
} from "@/domains/chat/authz";

export { ensureFullChatSessionForGrant } from "@/domains/chat/session";
