/**
 * Sprint 5 Phase 6 — notification preferences + quiet hours.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { NotifCategory, NotificationPreferences } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

const DEFAULTS: Omit<NotificationPreferences, "userId"> = {
  channelInApp: true,
  channelPush: false,
  channelEmail: false,
  catChat: true,
  catBookings: true,
  catEmergency: true,
  catProjects: true,
  catMarketplace: true,
  catPayments: true,
  catVoice: true,
  catTasks: true,
  catApprovals: true,
  catRecurring: true,
  catInvoices: true,
  catAdmin: true,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
  quietHoursTimezone: "Asia/Damascus",
  digestMorning: false,
  digestDaily: false,
  digestWeekly: false,
};

function mapPrefs(
  userId: string,
  row: Record<string, unknown> | null,
): NotificationPreferences {
  if (!row) return { userId, ...DEFAULTS };
  return {
    userId,
    channelInApp: Boolean(row.channel_in_app ?? true),
    channelPush: Boolean(row.channel_push ?? false),
    channelEmail: Boolean(row.channel_email ?? false),
    catChat: Boolean(row.cat_chat ?? true),
    catBookings: Boolean(row.cat_bookings ?? true),
    catEmergency: Boolean(row.cat_emergency ?? true),
    catProjects: Boolean(row.cat_projects ?? true),
    catMarketplace: Boolean(row.cat_marketplace ?? true),
    catPayments: Boolean(row.cat_payments ?? true),
    catVoice: Boolean(row.cat_voice ?? true),
    catTasks: Boolean(row.cat_tasks ?? true),
    catApprovals: Boolean(row.cat_approvals ?? true),
    catRecurring: Boolean(row.cat_recurring ?? true),
    catInvoices: Boolean(row.cat_invoices ?? true),
    catAdmin: Boolean(row.cat_admin ?? true),
    quietHoursEnabled: Boolean(row.quiet_hours_enabled ?? false),
    quietHoursStart: row.quiet_hours_start
      ? String(row.quiet_hours_start).slice(0, 5)
      : null,
    quietHoursEnd: row.quiet_hours_end
      ? String(row.quiet_hours_end).slice(0, 5)
      : null,
    quietHoursTimezone: String(row.quiet_hours_timezone ?? "Asia/Damascus"),
    digestMorning: Boolean(row.digest_morning ?? false),
    digestDaily: Boolean(row.digest_daily ?? false),
    digestWeekly: Boolean(row.digest_weekly ?? false),
  };
}

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  try {
    const { data } = await db()
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return mapPrefs(userId, data);
  } catch {
    return { userId, ...DEFAULTS };
  }
}

export async function upsertNotificationPreferences(
  userId: string,
  patch: Partial<Omit<NotificationPreferences, "userId">>,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const next = { ...current, ...patch, userId };

  const row = {
    user_id: userId,
    channel_in_app: next.channelInApp,
    channel_push: next.channelPush,
    channel_email: next.channelEmail,
    cat_chat: next.catChat,
    cat_bookings: next.catBookings,
    cat_emergency: next.catEmergency,
    cat_projects: next.catProjects,
    cat_marketplace: next.catMarketplace,
    cat_payments: next.catPayments,
    cat_voice: next.catVoice,
    cat_tasks: next.catTasks,
    cat_approvals: next.catApprovals,
    cat_recurring: next.catRecurring,
    cat_invoices: next.catInvoices,
    cat_admin: next.catAdmin,
    quiet_hours_enabled: next.quietHoursEnabled,
    quiet_hours_start: next.quietHoursStart,
    quiet_hours_end: next.quietHoursEnd,
    quiet_hours_timezone: next.quietHoursTimezone,
    digest_morning: next.digestMorning,
    digest_daily: next.digestDaily,
    digest_weekly: next.digestWeekly,
    updated_at: new Date().toISOString(),
  };

  try {
    await db().from("notification_preferences").upsert(row, {
      onConflict: "user_id",
    });
  } catch {
    // soft-fail
  }
  return next;
}

export function isCategoryEnabled(
  prefs: NotificationPreferences,
  category: NotifCategory,
): boolean {
  switch (category) {
    case "messages":
      return prefs.catChat;
    case "bookings":
      return prefs.catBookings;
    case "emergency":
      return prefs.catEmergency;
    case "projects":
      return prefs.catProjects;
    case "marketplace":
      return prefs.catMarketplace;
    case "payments":
      return prefs.catPayments;
    case "voice":
      return prefs.catVoice;
    case "tasks":
      return prefs.catTasks;
    case "approvals":
      return prefs.catApprovals;
    case "recurring":
      return prefs.catRecurring;
    case "invoices":
      return prefs.catInvoices;
    case "admin":
      return prefs.catAdmin;
    case "system":
      return true;
    default:
      return true;
  }
}

/**
 * Quiet hours: suppress push/email (in-app still delivered unless category off).
 * Handles overnight windows (e.g. 22:00–07:00).
 */
export function isInQuietHours(
  prefs: NotificationPreferences,
  now = new Date(),
): boolean {
  if (!prefs.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
    return false;
  }
  const [sh, sm] = prefs.quietHoursStart.split(":").map(Number);
  const [eh, em] = prefs.quietHoursEnd.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;

  // Approximate with local clock; timezone string stored for future refinement
  void prefs.quietHoursTimezone;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}
