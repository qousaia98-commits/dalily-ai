/**
 * Pre-acceptance privacy helpers.
 * Full contact must never appear in chat until unlock/grant.
 */

const CONTACT_PATTERNS = [
  /\+?\d[\d\s\-()]{7,}\d/g,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /(?:wa\.me|whatsapp\.com|t\.me|telegram\.me)\/\S+/gi,
  /https?:\/\/\S+/gi,
];

export function scrubContactLeaks(text: string): {
  text: string;
  scrubbed: boolean;
} {
  let out = text;
  let scrubbed = false;
  for (const re of CONTACT_PATTERNS) {
    const next = out.replace(re, "[hidden]");
    if (next !== out) scrubbed = true;
    out = next;
  }
  return { text: out, scrubbed };
}

export function assertPostUnlockContactSharing(input: {
  chatUnlocked: boolean;
  allowContactShare: boolean;
}): { allowed: boolean; reason?: string } {
  if (!input.chatUnlocked) {
    return { allowed: false, reason: "chat_locked" };
  }
  if (!input.allowContactShare) {
    return { allowed: false, reason: "privacy_disabled" };
  }
  return { allowed: true };
}
