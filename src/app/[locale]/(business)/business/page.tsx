import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { redirect } from "@/lib/i18n/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { getLocalizedField } from "@/types/provider.types";
import { countUnreadConversations } from "@/lib/business/conversations";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { countPendingRequestsForOwner, countTotalRequestsForProvider } from "@/lib/service-requests/queries";
import {
  getProviderVerificationForOwner,
  toBusinessVerificationView,
} from "@/lib/verification/queries";
import { shouldForceOnboarding } from "@/lib/business/onboarding";
import {
  ONBOARDING_CARD_DISMISS_COOKIE,
  ONBOARDING_DEFER_COOKIE,
  ONBOARDING_REMINDER_DISMISS_COOKIE,
  parseTimestampCookie,
} from "@/lib/business/onboarding-preference";
import { getOnboardingReminderState } from "@/lib/business/onboarding-reminders";
import { getProviderSuccessDashboard } from "@/lib/provider-success/dashboard-service";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";
import { GrowthHero } from "@/components/business/growth-hero";
import { FirstRequestMediaBanner } from "@/components/business/first-request-media-banner";
import { DashboardConversationsPreview } from "@/components/business/conversation-list";
import { ProviderSuccessDashboardView } from "@/components/provider-success/provider-success-dashboard";
import { VerificationDashboardAlert } from "@/components/business/verification-dashboard-alert";
import { OnboardingDashboardCard } from "@/components/business/onboarding/onboarding-dashboard-card";
import { ProviderDashboardHomeView } from "@/components/business/provider-dashboard-home";
import { getProviderDashboardHome } from "@/domains/provider/dashboard";
import { isProviderDashboardV2Enabled, isAiEngineV7Enabled, isPredictiveEngineEnabled, isAiEngineV9Enabled, isOfferDecisionEngineEnabled } from "@/lib/config/feature-flags";
import { buildPersonalizedGreeting } from "@/lib/greetings";
import type { PlanSlug } from "@/lib/subscription/types";
import type { Locale } from "@/lib/i18n/config";
import { ProviderAssistantPanel } from "@/components/assistant/provider-assistant-panel";
import { PredictiveNotificationsList } from "@/components/predictive/predictive-widgets";
import { AutomationSuggestionsList } from "@/components/automation/automation-widgets";
import type { AutomationSuggestion } from "@/lib/ai/automation/types";
import { ProviderVisibilityTipsCard } from "@/components/business/provider-visibility-tips";
import { loadProviderVisibilityTips } from "@/domains/offer/recommendation";

/**
 * Provider home — Sprint 8 unlock-first stack when PROVIDER_DASHBOARD_V2;
 * otherwise legacy Provider Success dashboard.
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

  const verificationRow = await getProviderVerificationForOwner(provider.id);
  const verification = toBusinessVerificationView(verificationRow);

  const jar = await cookies();
  const deferredAt = parseTimestampCookie(jar.get(ONBOARDING_DEFER_COOKIE)?.value);
  const onboardingDeferred = Boolean(deferredAt);

  if (shouldForceOnboarding(provider) && !onboardingDeferred) {
    redirect({ href: "/business/welcome", locale });
  }

  const businessName = getLocalizedField(provider.name, locale) || provider.id;

  if (isProviderDashboardV2Enabled()) {
    const { conversations } = await loadBusinessConversations(authUser.id);
    const unreadMessages = countUnreadConversations(conversations);
    const marketplaceHome = await getProviderDashboardHome(provider.id, {
      unreadMessages,
      ratingAvg: provider.ratingAvg,
    });
    const greeting = buildPersonalizedGreeting({
      roles: authUser.roles,
      displayName: authUser.displayName ?? businessName,
      email: authUser.email,
      locale,
      userId: authUser.id,
    });

    const visibilityTips = isOfferDecisionEngineEnabled()
      ? await loadProviderVisibilityTips(provider.id)
      : [];

    let providerAssistant = null;
    let providerPredictive = null;
    let providerAutomation: AutomationSuggestion[] = [];

    if (isAiEngineV7Enabled()) {
      const [{ listProviderBookings }, { listProviderOpportunities }, { buildProviderAssistant }] =
        await Promise.all([
          import("@/lib/booking/booking-service"),
          import("@/domains/offer/queries"),
          import("@/lib/ai/assistant/provider"),
        ]);
      const [bookings, opportunities] = await Promise.all([
        listProviderBookings(provider.id),
        listProviderOpportunities(provider.id),
      ]);
      providerAssistant = await buildProviderAssistant({
        providerId: provider.id,
        bookings: bookings.map((b) => ({
          id: b.id,
          title: b.serviceName || b.customerNotes || "Job",
          startsAt: b.startsAt,
          endsAt: b.endsAt,
        })),
        opportunities: opportunities
          .filter((o) => !o.hasOffer)
          .map((o) => ({
            assignmentId: o.assignmentId,
            title: o.title,
            urgency: o.urgency,
          })),
        missedOpportunities: opportunities.filter((o) => !o.hasOffer).length > 5
          ? opportunities.filter((o) => !o.hasOffer).length - 5
          : 0,
        freeSlotNearby: opportunities.some((o) => !o.hasOffer),
        preparationNotes: [
          "Review AI prep on each opportunity before offering.",
          "Confirm tools and travel buffer for today’s jobs.",
        ],
      });

      if (isPredictiveEngineEnabled()) {
        const {
          forecastDemand,
          forecastProviderAvailability,
          buildProviderPredictiveNotifications,
          persistPredictiveNotifications,
        } = await import("@/domains/forecast");
        const [demand, availability] = await Promise.all([
          forecastDemand({ horizonDays: 3 }),
          forecastProviderAvailability({
            providerId: provider.id,
            horizonDays: 3,
          }),
        ]);
        const tomorrow = availability[1];
        providerPredictive = await persistPredictiveNotifications(
          buildProviderPredictiveNotifications({
            demand,
            freeHoursTomorrow: tomorrow?.predictedFreeHours ?? null,
            categoryHints: demand.highlightsEn
              .slice(0, 2)
              .map((h) => h.split("—")[1]?.trim().split(":")[0]?.trim())
              .filter(Boolean) as string[],
          }),
          { providerId: provider.id },
        );
      }

      if (isAiEngineV9Enabled()) {
        const { runProviderAutomations } = await import(
          "@/lib/ai/automation/provider"
        );
        const [{ listProviderBookings }, { listProviderOpportunities }, { forecastProviderAvailability }] =
          await Promise.all([
            import("@/lib/booking/booking-service"),
            import("@/domains/offer/queries"),
            import("@/domains/forecast"),
          ]);
        const [bookings, opportunities, availability] = await Promise.all([
          listProviderBookings(provider.id),
          listProviderOpportunities(provider.id),
          forecastProviderAvailability({
            providerId: provider.id,
            horizonDays: 1,
          }),
        ]);
        const today = availability[0];
        const openNearby = opportunities.filter((o) => !o.hasOffer).length;
        providerAutomation = await runProviderAutomations({
          providerId: provider.id,
          userId: authUser.id,
          freeHoursToday: today?.predictedFreeHours ?? null,
          bookingsToday: bookings.length,
          nearbyOpenRequests: openNearby,
          overloaded: today?.expectedWorkload === "overloaded",
        });
      }
    }

    return (
      <div className="w-full max-w-full space-y-6 overflow-x-hidden animate-fade-in">
        <VerificationDashboardAlert provider={provider} verification={verification} />
        {providerAssistant ? (
          <ProviderAssistantPanel view={providerAssistant} />
        ) : null}
        {providerPredictive?.length ? (
          <PredictiveNotificationsList items={providerPredictive} />
        ) : null}
        {providerAutomation.length > 0 ? (
          <AutomationSuggestionsList items={providerAutomation} />
        ) : null}
        {visibilityTips.length > 0 ? (
          <ProviderVisibilityTipsCard tips={visibilityTips} />
        ) : null}
        <ProviderDashboardHomeView data={marketplaceHome} greeting={greeting} />
      </div>
    );
  }

  const cardDismissedAt = parseTimestampCookie(jar.get(ONBOARDING_CARD_DISMISS_COOKIE)?.value);
  const reminderDismissedAt = parseTimestampCookie(
    jar.get(ONBOARDING_REMINDER_DISMISS_COOKIE)?.value,
  );
  const reminder = getOnboardingReminderState({
    provider,
    verification,
    cardDismissedAt,
    reminderDismissedAt,
    locale,
  });

  const [{ subscription }, { conversations }, pendingRequests, totalRequests, success] =
    await Promise.all([
      getSubscriptionPageData(authUser.id),
      loadBusinessConversations(authUser.id),
      countPendingRequestsForOwner(authUser.id),
      countTotalRequestsForProvider(provider.id),
      getProviderSuccessDashboard({
        provider,
        ownerId: authUser.id,
        verification,
      }),
    ]);

  const planSlug = (subscription?.planSlug ?? "free") as PlanSlug;
  const unreadMessages = countUnreadConversations(conversations);

  const showVerification =
    provider.verificationStatus !== "verified" ||
    provider.status === "draft" ||
    provider.status === "pending_review" ||
    provider.status === "changes_requested";

  const onboardingHref =
    provider.status === "changes_requested" ||
    verification.status === "rejected" ||
    provider.verificationStatus === "rejected"
      ? "/business/verification"
      : "/business/welcome";

  return (
    <div className="w-full max-w-full space-y-8 overflow-x-hidden animate-fade-in">
      <GrowthHero
        planSlug={planSlug}
        businessName={businessName}
        pendingRequests={pendingRequests}
        unreadMessages={unreadMessages}
      />

      <VerificationDashboardAlert provider={provider} verification={verification} />

      {reminder.showDashboardCard ? (
        <OnboardingDashboardCard copyId={reminder.copyId} href={onboardingHref} />
      ) : null}

      <FirstRequestMediaBanner
        providerId={provider.id}
        totalRequests={totalRequests}
        galleryCount={provider.gallery.length}
      />

      <ProviderSuccessDashboardView
        data={success}
        showVerify={showVerification}
        userId={authUser.id}
        providerId={provider.id}
        reputationInsights={await (async () => {
          try {
            const { isAiReputationEngineEnabled } = await import(
              "@/lib/config/feature-flags"
            );
            if (!isAiReputationEngineEnabled()) return null;
            const { getProviderReputationInsights } = await import(
              "@/lib/reputation/insights"
            );
            const { recalculateProviderReputation } = await import(
              "@/lib/reputation/service"
            );
            let insights = await getProviderReputationInsights(
              provider.id,
              locale === "ar" ? "ar" : "en",
            );
            if (!insights) {
              await recalculateProviderReputation(provider.id);
              insights = await getProviderReputationInsights(
                provider.id,
                locale === "ar" ? "ar" : "en",
              );
            }
            return insights;
          } catch {
            return null;
          }
        })()}
      />

      <DashboardConversationsPreview conversations={conversations} />
    </div>
  );
}
