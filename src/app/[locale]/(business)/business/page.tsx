import { getLocale, getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { getLocalizedField } from "@/types/provider.types";
import { calculateBusinessHealth } from "@/lib/business/health-score";
import { computeAchievements } from "@/lib/business/achievements";
import { buildGrowthTips } from "@/lib/business/growth-tips";
import { buildGrowthNotifications } from "@/lib/business/notifications";
import {
  getLifetimeSearchAppearances,
  getWeeklyInsights,
} from "@/lib/business/insights";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";
import { ProviderStatusBadge } from "@/components/business/provider-status-badge";
import { GrowthHero } from "@/components/business/growth-hero";
import { GrowthHealthCard } from "@/components/business/growth-health-card";
import { GrowthInsightsGrid } from "@/components/business/growth-insights-grid";
import { GrowthAchievements } from "@/components/business/growth-achievements";
import { GrowthTipsList } from "@/components/business/growth-tips-list";
import { GrowthNotifications } from "@/components/business/growth-notifications";
import { GrowthTrustSection } from "@/components/business/growth-trust-section";
import { DashboardUpgradeCard } from "@/components/business/dashboard-upgrade-card";
import { DashboardPaymentStatusCard } from "@/components/business/dashboard-payment-status-card";
import { DashboardPaymentHistory } from "@/components/business/dashboard-payment-history";
import type { PlanSlug } from "@/lib/subscription/types";
import type { Locale } from "@/lib/i18n/config";

function planLabel(slug: string): string {
  if (slug === "premium") return "PREMIUM";
  if (slug === "pro") return "PRO";
  return "STARTER";
}

export default async function BusinessDashboardPage() {
  const t = await getTranslations("business.dashboard");
  const tSub = await getTranslations("business.subscription");
  const locale = (await getLocale()) as Locale;
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("noProviderSubtitle")}</p>
        </div>
        <ProviderCreateFormLoader />
      </div>
    );
  }

  const [{ subscription, payments, pendingPayment }, weekly, lifetimeSearches] =
    await Promise.all([
      getSubscriptionPageData(authUser.id),
      getWeeklyInsights(provider.id, provider.reviewCount),
      getLifetimeSearchAppearances(provider.id),
    ]);

  const planSlug = (subscription?.planSlug ?? "free") as PlanSlug;
  const subStatus = subscription?.status ?? "active";
  const health = calculateBusinessHealth(provider);
  const achievements = computeAchievements({
    provider,
    planSlug,
    searchAppearances: lifetimeSearches,
  });
  const tips = buildGrowthTips(provider);
  const businessName = getLocalizedField(provider.name, locale) || "Business";

  const underReview = payments.find((p) => p.paymentStatus === "pending_review");
  const recentlyPaid = payments.find(
    (p) =>
      p.paymentStatus === "paid" &&
      p.approvedAt &&
      Date.now() - new Date(p.approvedAt).getTime() < 1000 * 60 * 60 * 72,
  );
  const recentlyRejected = payments.find(
    (p) =>
      p.paymentStatus === "rejected" &&
      p.rejectedAt &&
      Date.now() - new Date(p.rejectedAt).getTime() < 1000 * 60 * 60 * 72,
  );

  const statusNotice = underReview
    ? {
        status: "pending_review" as const,
        planLabel: planLabel(pendingPayment?.planSlug ?? planSlug),
        amount: underReview.amount,
        currency: underReview.currency,
        reference: underReview.paymentReference,
        submittedAt: underReview.submittedAt,
        approvedAt: underReview.approvedAt,
        adminNote: underReview.adminNote,
      }
    : recentlyPaid
      ? {
          status: "paid" as const,
          planLabel: planLabel(planSlug),
          amount: recentlyPaid.amount,
          currency: recentlyPaid.currency,
          reference: recentlyPaid.paymentReference,
          submittedAt: recentlyPaid.submittedAt,
          approvedAt: recentlyPaid.approvedAt,
          adminNote: recentlyPaid.adminNote,
        }
      : recentlyRejected
        ? {
            status: "rejected" as const,
            planLabel: planLabel(recentlyRejected.planSlug),
            amount: recentlyRejected.amount,
            currency: recentlyRejected.currency,
            reference: recentlyRejected.paymentReference,
            submittedAt: recentlyRejected.submittedAt,
            approvedAt: recentlyRejected.approvedAt,
            adminNote: recentlyRejected.adminNote,
          }
        : null;

  const notifications = buildGrowthNotifications({
    healthScore: health.score,
    searchAppearances: weekly.searchAppearances,
    planSlug,
    subscriptionStatus: subStatus,
    verificationStatus: provider.verificationStatus,
    reviewCount: provider.reviewCount,
    hasPendingReviewPayment: Boolean(underReview),
    recentlyApprovedPayment: Boolean(recentlyPaid),
  });

  return (
    <div className="w-full max-w-full space-y-8 overflow-x-hidden animate-fade-in">
      <div className="flex justify-end">
        <ProviderStatusBadge status={provider.status} />
      </div>

      <GrowthHero planSlug={planSlug} businessName={businessName} />

      {statusNotice ? <DashboardPaymentStatusCard payment={statusNotice} /> : null}

      <GrowthHealthCard health={health} />

      <GrowthInsightsGrid insights={weekly} />

      <GrowthAchievements achievements={achievements} />

      <GrowthTipsList tips={tips} />

      <DashboardUpgradeCard
        planSlug={planSlug}
        status={subStatus}
        providerApproved={provider.status === "active"}
      />

      <GrowthNotifications items={notifications} />

      <DashboardPaymentHistory
        currentPlanLabel={planLabel(planSlug)}
        currentStatus={tSub(`status.${subStatus}`)}
        payments={payments.map((p) => ({
          id: p.id,
          planLabel: planLabel(p.planSlug),
          paymentStatus: p.paymentStatus,
          paymentReference: p.paymentReference,
          amount: p.amount,
          currency: p.currency,
          submittedAt: p.submittedAt,
          approvedAt: p.approvedAt,
          adminNote: p.adminNote,
          createdAt: p.createdAt,
        }))}
      />

      <GrowthTrustSection />
    </div>
  );
}
