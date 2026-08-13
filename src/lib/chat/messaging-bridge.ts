/**
 * Messaging Bridge (thin) — INTERNAL.
 *
 * Responsibilities: façade metadata, feature-flag pointers, future provider routing.
 * Conversation/message business logic lives in the Chat Engine (`src/lib/chat`).
 * Inbox list helpers remain in `src/lib/messaging` and `src/lib/dalily-messages`
 * (legacy compatibility hosts, accessed via domain adapters).
 *
 * External consumers MUST use `@/domains/chat`.
 *
 * @see docs/architecture/chat.md
 */

export const messagingBridge = {
  id: "messaging",
  status: "bridge" as const,
  impl: [
    "src/domains/chat (public API)",
    "src/lib/chat (chat engine)",
    "src/lib/messaging (inbox list helpers — legacy host)",
    "src/lib/dalily-messages (official Dalily thread — legacy host)",
    "src/hooks/use-chat-realtime (canonical realtime)",
  ],
  responsibilities: ["facade", "featureFlags", "providerRouting", "telemetry"] as const,
  future: ["external SMS/WhatsApp bridge", "multi-channel inbox unification"],
};

/** Alias for architecture docs */
export const chatModule = messagingBridge;
