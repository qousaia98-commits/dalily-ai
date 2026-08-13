/**
 * Client-safe feature flag helpers.
 * Server flags that are not NEXT_PUBLIC_* are unavailable in the browser —
 * expose only Sprint 5 Phase 3 chat AI via NEXT_PUBLIC_AI_CHAT_ASSISTANT
 * with a soft fallback to true when the public flag is unset (dev UX).
 */
export function isAiChatAssistantEnabledClient(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_AI_CHAT_ASSISTANT ??
    process.env.NEXT_PUBLIC_AI_CHAT_ASSISTANT_V1;
  if (!raw) return true;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "on";
}

export function isChatVoiceMessagingEnabledClient(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_CHAT_VOICE_MESSAGING ??
    process.env.NEXT_PUBLIC_CHAT_VOICE_MESSAGING_V1;
  if (!raw) return true;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "on";
}
