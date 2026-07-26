"use server";

import { requireAuthUser } from "@/lib/auth/session";
import { isSmartNotificationCenterEnabled } from "@/lib/config/feature-flags";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";
import {
  countUnreadSmartNotifications,
  createSmartNotification,
  generateNotificationDigest,
  getNotificationPreferences,
  groupNotificationsForFeed,
  listNotificationDigests,
  listSmartNotifications,
  markAllSmartNotificationsRead,
  markDigestOpened,
  updateSmartNotificationStatus,
  upsertNotificationPreferences,
  type GroupedFeedItem,
  type NotifCategory,
  type NotifDigestKind,
  type NotifStatus,
  type NotificationDigest,
  type NotificationPreferences,
  type SmartNotification,
} from "@/lib/notifications";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

export type NotifActionResult =
  | { ok: true }
  | { ok: false; error: string };

function featureOn() {
  return isSmartNotificationCenterEnabled();
}

export async function loadNotificationCenterAction(input?: {
  status?: NotifStatus | "all";
  category?: NotifCategory;
  query?: string;
}): Promise<
  | {
      ok: true;
      items: SmartNotification[];
      feed: GroupedFeedItem[];
      unreadCount: number;
    }
  | { ok: false; error: string }
> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();

  const [items, unreadCount] = await Promise.all([
    listSmartNotifications({
      userId: user.id,
      status: input?.status ?? "all",
      category: input?.category,
      query: input?.query,
    }),
    countUnreadSmartNotifications(user.id),
  ]);

  void emitAiLearningEvent({
    eventType: "notif_center_opened",
    customerId: user.id,
    metadata: { anonymized: true, unreadCount },
  });

  return {
    ok: true,
    items,
    feed: groupNotificationsForFeed(items.filter((n) => n.status !== "deleted")),
    unreadCount,
  };
}

export async function getNotificationUnreadCountAction(): Promise<number> {
  if (!featureOn()) return 0;
  const user = await requireAuthUser();
  return countUnreadSmartNotifications(user.id);
}

export async function markNotificationStatusAction(input: {
  notificationId: string;
  status: NotifStatus;
}): Promise<NotifActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const result = await updateSmartNotificationStatus({
    userId: user.id,
    notificationId: input.notificationId,
    status: input.status,
  });
  if (!result.ok) return result;

  const eventType =
    input.status === "read"
      ? "notif_marked_read"
      : input.status === "archived"
        ? "notif_archived"
        : input.status === "deleted"
          ? "notif_deleted"
          : input.status === "unread"
            ? "notif_marked_unread"
            : "notif_opened";

  void emitAiLearningEvent({
    eventType,
    customerId: user.id,
    metadata: { anonymized: true },
  });

  if (input.status === "read") {
    void emitAiLearningEvent({
      eventType: "notif_opened",
      customerId: user.id,
      metadata: { anonymized: true },
    });
  }

  return { ok: true };
}

export async function dismissNotificationAction(input: {
  notificationId: string;
}): Promise<NotifActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const result = await updateSmartNotificationStatus({
    userId: user.id,
    notificationId: input.notificationId,
    status: "archived",
  });
  if (!result.ok) return result;
  void emitAiLearningEvent({
    eventType: "notif_dismissed",
    customerId: user.id,
    metadata: { anonymized: true },
  });
  return { ok: true };
}

export async function completeNotificationActionAction(input: {
  notificationId: string;
  actionKey: string;
}): Promise<NotifActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  await updateSmartNotificationStatus({
    userId: user.id,
    notificationId: input.notificationId,
    status: "read",
  });
  void emitAiLearningEvent({
    eventType: "notif_action_completed",
    customerId: user.id,
    metadata: { anonymized: true, actionKey: input.actionKey },
  });
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<NotifActionResult> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  await markAllSmartNotificationsRead(user.id);
  return { ok: true };
}

export async function loadNotificationPreferencesAction(): Promise<
  | { ok: true; preferences: NotificationPreferences }
  | { ok: false; error: string }
> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const preferences = await getNotificationPreferences(user.id);
  return { ok: true, preferences };
}

export async function saveNotificationPreferencesAction(
  patch: Partial<Omit<NotificationPreferences, "userId">>,
): Promise<
  | { ok: true; preferences: NotificationPreferences }
  | { ok: false; error: string }
> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const preferences = await upsertNotificationPreferences(user.id, patch);
  void emitAiLearningEvent({
    eventType: "notif_preference_changed",
    customerId: user.id,
    metadata: { anonymized: true },
  });
  return { ok: true, preferences };
}

export async function generateDigestAction(input: {
  kind: NotifDigestKind;
  locale?: string;
}): Promise<
  | { ok: true; digest: NotificationDigest }
  | { ok: false; error: string }
> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const rate = checkRateLimit(rateLimitKey("notif_digest", user.id), {
    max: 10,
    windowMs: 60_000,
  });
  if (!rate.ok) return { ok: false, error: "rate_limited" };
  const result = await generateNotificationDigest({
    userId: user.id,
    kind: input.kind,
    locale: input.locale,
  });
  if (!result.ok) return result;
  void emitAiLearningEvent({
    eventType: "notif_digest_generated",
    customerId: user.id,
    metadata: { anonymized: true, kind: input.kind },
  });
  return result;
}

export async function openDigestAction(input: {
  digestId: string;
}): Promise<
  | { ok: true; digests: NotificationDigest[] }
  | { ok: false; error: string }
> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  await markDigestOpened(user.id, input.digestId);
  void emitAiLearningEvent({
    eventType: "notif_digest_opened",
    customerId: user.id,
    metadata: { anonymized: true },
  });
  const digests = await listNotificationDigests(user.id);
  return { ok: true, digests };
}

export async function listDigestsAction(): Promise<
  | { ok: true; digests: NotificationDigest[] }
  | { ok: false; error: string }
> {
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  return { ok: true, digests: await listNotificationDigests(user.id) };
}

/** Dev/demo helper: seed a sample notification for the current user. */
export async function seedDemoNotificationAction(): Promise<NotifActionResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "not_available" };
  }
  if (!featureOn()) return { ok: false, error: "feature_disabled" };
  const user = await requireAuthUser();
  const rate = checkRateLimit(rateLimitKey("notif_seed", user.id), {
    max: 5,
    windowMs: 60_000,
  });
  if (!rate.ok) return { ok: false, error: "rate_limited" };
  const result = await createSmartNotification({
    userId: user.id,
    category: "marketplace",
    eventKey: "demo_tip",
    titleEn: "Welcome to your notification center",
    titleAr: "مرحباً بك في مركز الإشعارات",
    bodyEn: "Important marketplace, booking and project updates appear here.",
    bodyAr: "تظهر هنا تحديثات السوق والحجوزات والمشاريع المهمة.",
    href: "/account",
    actionKey: "open",
    actionLabelEn: "Open account",
    actionLabelAr: "فتح الحساب",
    priority: "normal",
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
