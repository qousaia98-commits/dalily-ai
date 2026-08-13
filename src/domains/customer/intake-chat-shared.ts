/**
 * Shared intake-chat helpers safe for client + server (no LLM / DB imports).
 */

export type IntakeChatRole = "user" | "assistant";

export type IntakeChatMessage = {
  role: IntakeChatRole;
  content: string;
};

export const INTAKE_CHAT_MAX_MESSAGES = 12;
export const INTAKE_CHAT_MAX_MESSAGE_CHARS = 800;

/** Prefer model summary; else join user utterances for `/request/new?q=`. */
export function composeIntakeHandoffQuery(
  messages: IntakeChatMessage[],
  preferredSummary?: string | null,
): string {
  const preferred = preferredSummary?.trim();
  if (preferred && preferred.length >= 8) {
    return preferred.slice(0, 2000);
  }
  const userParts = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean);
  return userParts.join(" · ").slice(0, 2000);
}
