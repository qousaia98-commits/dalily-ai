import { cache } from "react";
import { cookies } from "next/headers";
import { getOwnedProvider } from "@/lib/providers/database";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { buildBusinessNotifications } from "@/lib/business/notification-inbox";
import {
  applyConversationReadState,
  buildBusinessConversations,
  compareConversationsByLatestMessage,
} from "@/lib/business/conversations";
import { MSG_READ_COOKIE, parseMsgReadCookie } from "@/lib/business/message-read-state";
import { loadConversationsForBusiness } from "@/lib/messaging/queries";
import { listDalilyInboxMessages } from "@/lib/dalily-messages/inbox";
import type { PlanSlug } from "@/lib/subscription/types";

function planLabel(slug: string): string {
  if (slug === "premium") return "PREMIUM";
  if (slug === "pro") return "PRO";
  return "STARTER";
}

/** Request-scoped cache — layout, dashboard, and mobile badges share one load. */
export const loadBusinessConversations = cache(async function loadBusinessConversations(
  userId: string,
) {
  const jar = await cookies();
  const readMap = parseMsgReadCookie(jar.get(MSG_READ_COOKIE)?.value);
  const dalilyInbox = await listDalilyInboxMessages(userId);

  const provider = await getOwnedProvider(userId);
  if (!provider) {
    return {
      conversations: buildBusinessConversations({
        notifications: dalilyInbox,
        readMap,
      }),
      planSlug: "free" as PlanSlug,
      provider: null,
    };
  }

  try {
    const { subscription, payments } = await getSubscriptionPageData(userId);
    const planSlug = (subscription?.planSlug ?? "free") as PlanSlug;
    const underReview = payments.find((p) => p.paymentStatus === "pending_review");
    const recentlyPaid = payments.find(
      (p) =>
        p.paymentStatus === "paid" &&
        p.approvedAt &&
        Date.now() - new Date(p.approvedAt).getTime() < 1000 * 60 * 60 * 24,
    );

    const statusNotifications = buildBusinessNotifications({
      providerStatus: provider.status,
      verificationStatus: provider.verificationStatus,
      planSlug,
      subscriptionStatus: subscription?.status ?? "active",
      adminReviewNote: provider.adminReviewNote,
      changesRequestedAt: provider.changesRequestedAt,
      pendingReviewPayment: underReview
        ? {
            id: underReview.id,
            planLabel: planLabel(underReview.planSlug),
            submittedAt: underReview.submittedAt,
          }
        : null,
      recentlyPaid: recentlyPaid
        ? {
            id: recentlyPaid.id,
            planLabel: planLabel(planSlug),
            approvedAt: recentlyPaid.approvedAt,
          }
        : null,
      expiresAt: subscription?.expiresAt ?? null,
      reviewCount: provider.reviewCount,
    });

    const notifications = [...statusNotifications, ...dalilyInbox];
    const dalilyConversations = buildBusinessConversations({ notifications, readMap });
    const customerConversations = applyConversationReadState(
      await loadConversationsForBusiness(userId),
      readMap,
    );
    const conversations = [...customerConversations, ...dalilyConversations].sort(
      compareConversationsByLatestMessage,
    );

    return {
      conversations,
      planSlug,
      provider,
    };
  } catch {
    const statusNotifications = buildBusinessNotifications({
      providerStatus: provider.status,
      verificationStatus: provider.verificationStatus,
      planSlug: "free",
      subscriptionStatus: "active",
      adminReviewNote: provider.adminReviewNote,
      changesRequestedAt: provider.changesRequestedAt,
      reviewCount: provider.reviewCount,
    });
    const notifications = [...statusNotifications, ...dalilyInbox];
    const dalilyConversations = buildBusinessConversations({ notifications, readMap });
    const customerConversations = applyConversationReadState(
      await loadConversationsForBusiness(userId),
      readMap,
    );
    const conversations = [...customerConversations, ...dalilyConversations].sort(
      compareConversationsByLatestMessage,
    );
    return {
      conversations,
      planSlug: "free" as PlanSlug,
      provider,
    };
  }
});
