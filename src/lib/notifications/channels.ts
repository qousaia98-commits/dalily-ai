/**
 * Sprint 5 Phase 6 — delivery channels (in-app, push stub, email).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getNotificationPreferences,
  isCategoryEnabled,
  isInQuietHours,
} from "./preferences";
import type { NotifChannel, SmartNotification } from "./types";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

async function logAttempt(input: {
  notificationId: string;
  userId: string;
  channel: NotifChannel;
  status: "sent" | "skipped" | "failed";
  skipReason?: string;
  errorMessage?: string;
}) {
  try {
    await db().from("notification_delivery_attempts").insert({
      notification_id: input.notificationId,
      user_id: input.userId,
      channel: input.channel,
      status: input.status,
      skip_reason: input.skipReason ?? null,
      error_message: input.errorMessage ?? null,
    });
  } catch {
    // soft
  }
}

async function sendNotificationEmail(input: {
  userId: string;
  title: string;
  body: string;
  href?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Dalily <noreply@dalily.app>";
  if (!apiKey) return { sent: false, error: "no_resend_key" };

  try {
    const { data: user } = await db().auth.admin.getUserById(input.userId);
    const to = user?.user?.email;
    if (!to) return { sent: false, error: "no_email" };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const link = input.href
      ? input.href.startsWith("http")
        ? input.href
        : `${appUrl}${input.href}`
      : appUrl;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.title,
        html: `<p>${input.body}</p><p><a href="${link}">Open in Dalily</a></p>`,
      }),
    });
    if (!res.ok) return { sent: false, error: await res.text() };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "email_failed" };
  }
}

/**
 * Route a persisted smart notification through enabled channels.
 * Push is preference-aware stub (logs attempt; no FCM yet).
 */
export async function deliverSmartNotificationChannels(
  notification: SmartNotification,
  opts?: { forceInAppOnly?: boolean; locale?: string },
): Promise<void> {
  const prefs = await getNotificationPreferences(notification.userId);
  if (!isCategoryEnabled(prefs, notification.category)) {
    await logAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: "in_app",
      status: "skipped",
      skipReason: "category_disabled",
    });
    return;
  }

  const quiet = isInQuietHours(prefs);
  const isCritical = notification.priority === "critical";
  const locale = opts?.locale === "ar" ? "ar" : "en";
  const title = locale === "ar" ? notification.titleAr : notification.titleEn;
  const body = locale === "ar" ? notification.bodyAr : notification.bodyEn;

  // In-app row already exists — log delivery
  if (prefs.channelInApp) {
    await logAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: "in_app",
      status: "sent",
    });
  } else {
    await logAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: "in_app",
      status: "skipped",
      skipReason: "channel_disabled",
    });
  }

  if (opts?.forceInAppOnly) return;

  // Push (stub)
  if (prefs.channelPush && (!quiet || isCritical)) {
    const { data: subs } = await db()
      .from("notification_push_subscriptions")
      .select("id")
      .eq("user_id", notification.userId)
      .eq("enabled", true)
      .limit(1);

    if (subs?.length) {
      await logAttempt({
        notificationId: notification.id,
        userId: notification.userId,
        channel: "push",
        status: "sent",
        skipReason: "stub_accepted",
      });
    } else {
      await logAttempt({
        notificationId: notification.id,
        userId: notification.userId,
        channel: "push",
        status: "skipped",
        skipReason: "no_subscription",
      });
    }
  } else {
    await logAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: "push",
      status: "skipped",
      skipReason: quiet && !isCritical ? "quiet_hours" : "channel_disabled",
    });
  }

  // Email
  if (prefs.channelEmail && (!quiet || isCritical)) {
    const result = await sendNotificationEmail({
      userId: notification.userId,
      title,
      body,
      href: notification.href,
    });
    await logAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: "email",
      status: result.sent ? "sent" : "failed",
      errorMessage: result.error,
    });
  } else {
    await logAttempt({
      notificationId: notification.id,
      userId: notification.userId,
      channel: "email",
      status: "skipped",
      skipReason: quiet && !isCritical ? "quiet_hours" : "channel_disabled",
    });
  }
}
