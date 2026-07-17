import { getOwnedProvider } from "@/lib/providers/queries";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { buildBusinessNotifications } from "@/lib/business/notification-inbox";
import { buildBusinessConversations } from "@/lib/business/conversations";
import { MSG_READ_COOKIE, parseMsgReadCookie } from "@/lib/business/message-read-state";
import type { PlanSlug } from "@/lib/subscription/types";
import { cookies } from "next/headers";

function planLabel(slug: string): string {
  if (slug === "premium") return "PREMIUM";
  if (slug === "pro") return "PRO";
  return "STARTER";
}

export async function loadBusinessConversations(userId: string) {
  const jar = await cookies();
  const readMap = parseMsgReadCookie(jar.get(MSG_READ_COOKIE)?.value);

  const provider = await getOwnedProvider(userId);
  if (!provider) {
    return {
      conversations: buildBusinessConversations({ notifications: [], readMap }),
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

    const notifications = buildBusinessNotifications({
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

    return {
      conversations: buildBusinessConversations({ notifications, readMap }),
      planSlug,
      provider,
    };
  } catch {
    const notifications = buildBusinessNotifications({
      providerStatus: provider.status,
      verificationStatus: provider.verificationStatus,
      planSlug: "free",
      subscriptionStatus: "active",
      adminReviewNote: provider.adminReviewNote,
      changesRequestedAt: provider.changesRequestedAt,
      reviewCount: provider.reviewCount,
    });
    return {
      conversations: buildBusinessConversations({ notifications, readMap }),
      planSlug: "free" as PlanSlug,
      provider,
    };
  }
}
