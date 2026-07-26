/**
 * Deliver marketplace notifications without relying on notify_marketplace_user auth.uid().
 * Service-role admin client can insert directly (bypasses RLS).
 * When SMART_NOTIFICATION_CENTER is on, also mirrors into the unified center.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { isSmartNotificationCenterEnabled } from "@/lib/config/feature-flags";

export type MarketplaceNotifyInput = {
  userId: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  href?: string | null;
  requestId?: string | null;
  conversationId?: string | null;
};

export type MarketplaceDeliveryResult = {
  userId: string;
  ok: boolean;
  error?: string;
  notificationId?: string;
};

/**
 * Insert one notification row. Returns false on failure (never throws).
 */
export async function deliverMarketplaceNotification(
  input: MarketplaceNotifyInput,
): Promise<MarketplaceDeliveryResult> {
  const admin = createAdminClient();
  try {
    const { data, error } = await admin
      .from("marketplace_notifications")
      .insert({
        user_id: input.userId,
        type: input.type,
        title_key: input.titleKey,
        body_key: input.bodyKey,
        body_params: input.bodyParams ?? {},
        href: input.href ?? null,
        service_request_id: input.requestId ?? null,
        conversation_id: input.conversationId ?? null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return { userId: input.userId, ok: false, error: error.message };
    }

    if (data?.id && isSmartNotificationCenterEnabled()) {
      try {
        const { createSmartNotification, categoryFromMarketplaceType } =
          await import("@/lib/notifications/center");
        const title = input.titleKey.split(".").pop() ?? input.type;
        await createSmartNotification({
          userId: input.userId,
          category: categoryFromMarketplaceType(input.type),
          eventKey: input.type,
          titleEn: title,
          titleAr: title,
          bodyEn: input.bodyKey,
          bodyAr: input.bodyKey,
          href: input.href ?? null,
          actionKey: "open",
          marketplaceNotificationId: data.id,
          metadata: {
            titleKey: input.titleKey,
            bodyKey: input.bodyKey,
            bodyParams: input.bodyParams ?? {},
            conversationId: input.conversationId ?? null,
            requestId: input.requestId ?? null,
          },
          groupKey: input.conversationId
            ? `msg:${input.conversationId}`
            : undefined,
        });
      } catch {
        // mirror is best-effort; marketplace row remains source of truth for legacy UI
      }
    }

    return {
      userId: input.userId,
      ok: true,
      notificationId: data?.id,
    };
  } catch (e) {
    return {
      userId: input.userId,
      ok: false,
      error: e instanceof Error ? e.message : "unknown",
    };
  }
}

export type BroadcastDeliveryDiagnostics = {
  recipientsFound: number;
  notificationsCreated: number;
  deliverySuccess: number;
  deliveryFailures: number;
  skippedUsers: number;
  failedUserIds: string[];
};

/**
 * Deliver to many users — continue on individual failures.
 * Optional per-user href via hrefByUserId.
 */
export async function deliverMarketplaceNotificationsBatch(
  userIds: string[],
  payload: Omit<MarketplaceNotifyInput, "userId" | "href"> & {
    href?: string | null;
  },
  options?: {
    max?: number;
    hrefByUserId?: Map<string, string>;
  },
): Promise<BroadcastDeliveryDiagnostics> {
  const max = options?.max ?? 2000;
  const recipients = userIds.slice(0, max);
  const skippedUsers = Math.max(0, userIds.length - recipients.length);

  let deliverySuccess = 0;
  let deliveryFailures = 0;
  const failedUserIds: string[] = [];

  for (const userId of recipients) {
    const href =
      options?.hrefByUserId?.get(userId) ?? payload.href ?? null;
    const result = await deliverMarketplaceNotification({
      ...payload,
      userId,
      href,
    });
    if (result.ok) {
      deliverySuccess += 1;
    } else {
      deliveryFailures += 1;
      if (failedUserIds.length < 50) failedUserIds.push(userId);
    }
  }

  return {
    recipientsFound: userIds.length,
    notificationsCreated: deliverySuccess,
    deliverySuccess,
    deliveryFailures,
    skippedUsers,
    failedUserIds,
  };
}
