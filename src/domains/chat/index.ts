/**
 * SAD Chat domain facade (Sprint 0).
 * Grant-based authZ arrives in Sprint 7 — no gate change now.
 */

export const CHAT_DOMAIN = {
  service: "chat",
  owns: ["threads", "messages", "qa_items"],
  impl: ["src/lib/chat", "src/lib/messaging"],
  status: "facade",
} as const;

export type * from "@/lib/chat/types";
