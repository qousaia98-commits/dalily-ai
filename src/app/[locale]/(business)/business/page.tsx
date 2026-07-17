import { getLocale, getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { getLocalizedField } from "@/types/provider.types";
import { getWeeklyInsights } from "@/lib/business/insights";
import {
  countUnreadConversations,
} from "@/lib/business/conversations";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";
import { GrowthHero } from "@/components/business/growth-hero";
import { DashboardTodayOverview } from "@/components/business/dashboard-today-overview";
import { DashboardQuickActions } from "@/components/business/dashboard-quick-actions";
import { DashboardConversationsPreview } from "@/components/business/conversation-list";
import { ChangesRequiredCard } from "@/components/business/changes-required-card";
import type { PlanSlug } from "@/lib/subscription/types";
import type { Locale } from "@/lib/i18n/config";

/**
 * Business homepage — calm, 5-second overview.
 * Heavy growth / analytics live on /business/analytics.
 */
export default async function BusinessDashboardPage() {
  const t = await getTranslations("business.dashboard");
  const locale = (await getLocale()) as Locale;
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("noProviderSubtitle")}</p>
        </div>
        <ProviderCreateFormLoader />
      </div>
    );
  }

  // Lightweight only — no growth-potential / location / snapshot queries
  const [{ subscription }, { conversations }, weekly] = await Promise.all([
    getSubscriptionPageData(authUser.id),
    loadBusinessConversations(authUser.id),
    getWeeklyInsights(provider.id, provider.reviewCount),
  ]);

  const planSlug = (subscription?.planSlug ?? "free") as PlanSlug;
  const businessName = getLocalizedField(provider.name, locale) || "Business";
  const unreadMessages = countUnreadConversations(conversations);

  const showVerification =
    provider.verificationStatus !== "verified" ||
    provider.status === "draft" ||
    provider.status === "pending_review" ||
    provider.status === "changes_requested";

  return (
    <div className="w-full max-w-full space-y-8 overflow-x-hidden animate-fade-in">
      <GrowthHero planSlug={planSlug} businessName={businessName} />

      {provider.status === "changes_requested" && provider.adminReviewNote ? (
        <ChangesRequiredCard note={provider.adminReviewNote} />
      ) : null}

      <DashboardTodayOverview
        data={{
          profileViews: weekly.profileViews ?? 0,
          unreadMessages,
          newContacts: weekly.contactClicks ?? 0,
          growthAppearances: weekly.searchAppearances,
        }}
      />

      <DashboardConversationsPreview conversations={conversations} />

      <DashboardQuickActions
        planSlug={planSlug}
        publicHref={provider.status === "active" ? `/providers/${provider.id}` : null}
        showVerification={showVerification}
      />
    </div>
  );
}
