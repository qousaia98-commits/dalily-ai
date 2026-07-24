/**
 * Provider onboarding preferences — cookie watermarks (same pattern as message-read / admin badges).
 * Encouragement only — never forces verification.
 */

export const ONBOARDING_DEFER_COOKIE = "dalily_onboarding_defer";
export const ONBOARDING_REMINDER_DISMISS_COOKIE = "dalily_onboarding_reminder_dismiss";
export const ONBOARDING_CARD_DISMISS_COOKIE = "dalily_onboarding_card_dismiss";

/** Session defer — hide forced welcome for this browser session (≈ 12h). */
export const ONBOARDING_DEFER_MAX_AGE_SEC = 60 * 60 * 12;

/** After dismissing a reminder/card, wait this many days before showing again. */
export const REMINDER_COOLDOWN_DAYS = 5;

export type OnboardingDeferPayload = {
  at: number;
  providerId?: string;
};

export function parseTimestampCookie(raw: string | undefined): number | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { at?: number };
    if (typeof parsed?.at === "number" && Number.isFinite(parsed.at)) return parsed.at;
  } catch {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function serializeTimestampCookie(at: number): string {
  return encodeURIComponent(JSON.stringify({ at }));
}

export function isCooldownActive(dismissedAtMs: number | null, cooldownDays = REMINDER_COOLDOWN_DAYS): boolean {
  if (!dismissedAtMs) return false;
  const ms = cooldownDays * 24 * 60 * 60 * 1000;
  return Date.now() - dismissedAtMs < ms;
}

/** Days since provider account / profile creation for soft reminders. */
export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

export type ReminderTier = 3 | 7 | 14 | 30;

export function resolveReminderTier(days: number): ReminderTier[] {
  const tiers: ReminderTier[] = [];
  if (days >= 3) tiers.push(3);
  if (days >= 7) tiers.push(7);
  if (days >= 14) tiers.push(14);
  if (days >= 30) tiers.push(30);
  return tiers;
}
