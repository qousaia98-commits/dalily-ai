/**
 * Deliver marketplace notifications without relying on notify_marketplace_user auth.uid().
 * Service-role admin client can insert directly (bypasses RLS).
 * Used for admin broadcasts, warnings, and verification system notices.
 */

import { createAdminClient } from "@/lib/supabase/admin";

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
};

/**
 * Insert one notification row. Returns false on failure (never throws).
 */
export async function deliverMarketplaceNotification(
  input: MarketplaceNotifyInput,
): Promise<MarketplaceDeliveryResult> {
  const admin = createAdminClient();
  try {
    const { error } = await admin.from("marketplace_notifications").insert({
      user_id: input.userId,
      type: input.type,
      title_key: input.titleKey,
      body_key: input.bodyKey,
      body_params: input.bodyParams ?? {},
      href: input.href ?? null,
      service_request_id: input.requestId ?? null,
      conversation_id: input.conversationId ?? null,
    });

    if (error) {
      return { userId: input.userId, ok: false, error: error.message };
    }
    return { userId: input.userId, ok: true };
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
 */
export async function deliverMarketplaceNotificationsBatch(
  userIds: string[],
  payload: Omit<MarketplaceNotifyInput, "userId">,
  options?: { max?: number },
): Promise<BroadcastDeliveryDiagnostics> {
  const max = options?.max ?? 2000;
  const recipients = userIds.slice(0, max);
  const skippedUsers = Math.max(0, userIds.length - recipients.length);

  let deliverySuccess = 0;
  let deliveryFailures = 0;
  const failedUserIds: string[] = [];

  for (const userId of recipients) {
    const result = await deliverMarketplaceNotification({
      ...payload,
      userId,
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
