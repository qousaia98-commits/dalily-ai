/**
 * Conversation / message timestamp helpers.
 * Never treat Unix epoch (or other invalid values) as a real message time.
 */

const MIN_VALID_MS = Date.UTC(2000, 0, 1);

export function isValidMessageTimestamp(iso: string | null | undefined): boolean {
  if (!iso || typeof iso !== "string") return false;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) && ms >= MIN_VALID_MS;
}

/** Newest valid message timestamp, or null when none exists. */
export function resolveLatestMessageAt(
  messages: ReadonlyArray<{ createdAt: string }>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const at = messages[i]?.createdAt;
    if (isValidMessageTimestamp(at)) return at;
  }
  return null;
}

export type ConversationTimeLabels = {
  yesterday: string;
};

/**
 * Natural list timestamp:
 * - today → localized time
 * - yesterday → "Yesterday"
 * - within last 7 days → weekday
 * - older → localized date
 * Returns null when there is no valid timestamp (caller shows placeholder).
 */
export function formatConversationListTime(
  iso: string | null | undefined,
  locale: string,
  labels: ConversationTimeLabels,
): string | null {
  if (!isValidMessageTimestamp(iso)) return null;

  const date = new Date(iso as string);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMsg = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfMsg.getTime()) / 86_400_000);

  if (dayDiff === 0) {
    return new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  if (dayDiff === 1) {
    return labels.yesterday;
  }

  if (dayDiff > 1 && dayDiff < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatMessageTime(iso: string | null | undefined, locale: string): string | null {
  if (!isValidMessageTimestamp(iso)) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso as string));
}
