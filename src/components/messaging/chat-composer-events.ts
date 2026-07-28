"use client";

export type ChatReplyTarget = { messageId: string; preview: string };

/** Helper used by message bubbles to set reply target on the active shell. */
export function requestChatReply(payload: ChatReplyTarget) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("dalily-chat-reply", { detail: payload }),
  );
}

/** Insert editable AI suggestion into the composer (never auto-sends). */
export function requestChatDraft(text: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("dalily-chat-draft", { detail: { text } }));
}
