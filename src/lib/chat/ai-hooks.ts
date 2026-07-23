/**
 * Future AI features plug into Chat without refactoring core services.
 * Sprint 36 ships stubs only — do not call remote AI from here yet.
 */

import type { ChatAiExtensionPoint, ChatAiHookContext } from "@/lib/chat/types";

export type ChatAiHookResult = {
  extension: ChatAiExtensionPoint;
  supported: boolean;
  payload?: Record<string, unknown>;
};

const SUPPORTED: ChatAiExtensionPoint[] = [
  "auto_translation",
  "conversation_summary",
  "suggested_replies",
  "appointment_detection",
  "price_extraction",
  "address_extraction",
  "sentiment_detection",
];

/** Declares which AI extensions the chat module is ready to host. */
export function listChatAiExtensionPoints(): ChatAiExtensionPoint[] {
  return [...SUPPORTED];
}

/**
 * Reserved entry point for future AI processors.
 * Always returns supported:false until a concrete provider is registered.
 */
export async function runChatAiHook(
  extension: ChatAiExtensionPoint,
  _context: ChatAiHookContext,
): Promise<ChatAiHookResult> {
  void _context;
  return { extension, supported: false };
}
