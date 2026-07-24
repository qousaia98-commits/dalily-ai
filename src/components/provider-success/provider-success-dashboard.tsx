import type { ProviderSuccessDashboard } from "@/lib/provider-success/types";
import { TodaySchedule } from "@/components/provider-success/today-schedule";
import { NotificationsWidget } from "@/components/provider-success/notifications-widget";
import { PerformanceCards } from "@/components/provider-success/performance-cards";
import { InsightsPanel } from "@/components/provider-success/insights-panel";
import { ProfileCompletionRing } from "@/components/provider-success/profile-completion-ring";
import { SuccessQuickActions } from "@/components/provider-success/success-quick-actions";
import { ActivityTimeline } from "@/components/provider-success/activity-timeline";
import {
  LeaderboardCard,
  AchievementsPanel,
} from "@/components/provider-success/leaderboard-card";
import { SuccessChartsLazy } from "@/components/provider-success/success-charts-lazy";
import { DalilyScoreBreakdownCard } from "@/components/provider-success/dalily-score-breakdown-card";
import { TodayOverviewStrip } from "@/components/provider-success/today-overview-strip";
import { MyBusinessStrip } from "@/components/provider-success/my-business-strip";
import { MarketplaceRealtimeBridge } from "@/components/marketplace/realtime-bridge";
import { getTranslations } from "next-intl/server";

type Props = {
  data: ProviderSuccessDashboard;
  showVerify: boolean;
  userId: string;
  providerId?: string | null;
};

/**
 * Provider Success Dashboard — hierarchy optimized for “what do I need to do today?”
 * Widgets reused; no business-logic changes.
 */
export async function ProviderSuccessDashboardView({
  data,
  showVerify,
  userId,
  providerId,
}: Props) {
  const t = await getTranslations("business.success.sections");

  return (
    <div className="space-y-10">
      {/* Keep notification cards in sync when Dalily messages are marked read. */}
      <MarketplaceRealtimeBridge userId={userId} providerId={providerId} />

      {/* Section 1 — Today's Overview */}
      <section className="space-y-4" aria-labelledby="today-overview-title">
        <header className="space-y-1">
          <h2 id="today-overview-title" className="text-lg font-bold tracking-tight">
            {t("today")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("todayHint")}</p>
        </header>
        <TodayOverviewStrip kpis={data.kpis} unreadNotifications={data.unreadNotificationCount} />
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <TodaySchedule appointments={data.todaySchedule} />
          <NotificationsWidget
            items={data.notifications}
            unreadCount={data.unreadNotificationCount}
          />
        </div>
      </section>

      {/* Section 2 — My Business */}
      <section className="space-y-4" aria-labelledby="my-business-title">
        <header className="space-y-1">
          <h2 id="my-business-title" className="text-lg font-bold tracking-tight">
            {t("business")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("businessHint")}</p>
        </header>
        <MyBusinessStrip kpis={data.kpis} />
        <div className="grid gap-6 lg:grid-cols-2">
          <DalilyScoreBreakdownCard
            breakdown={data.dalilyBreakdown}
            tips={data.rankingTips}
          />
          <ProfileCompletionRing
            percent={data.kpis.profileCompletion}
            missing={data.profileMissing}
          />
        </div>
      </section>

      {/* Section 3 — Performance */}
      <section className="space-y-4" aria-labelledby="performance-title">
        <header className="space-y-1">
          <h2 id="performance-title" className="text-lg font-bold tracking-tight">
            {t("performance")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("performanceHint")}</p>
        </header>
        <PerformanceCards metrics={data.performance} hideHeader />
      </section>

      {/* Section 4 — Quick Actions */}
      <section className="space-y-4" aria-labelledby="actions-title">
        <header className="space-y-1">
          <h2 id="actions-title" className="text-lg font-bold tracking-tight">
            {t("actions")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("actionsHint")}</p>
        </header>
        <SuccessQuickActions showVerify={showVerify} hideHeader />
      </section>

      {/* Section 5 — Recommendations */}
      <section className="space-y-4" aria-labelledby="tips-title">
        <header className="space-y-1">
          <h2 id="tips-title" className="text-lg font-bold tracking-tight">
            {t("recommendations")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("recommendationsHint")}</p>
        </header>
        <InsightsPanel insights={data.insights} hideHeader />
      </section>

      {/* Section 6 — Statistics */}
      <section className="space-y-6" aria-labelledby="stats-title">
        <header className="space-y-1">
          <h2 id="stats-title" className="text-lg font-bold tracking-tight">
            {t("statistics")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("statisticsHint")}</p>
        </header>
        <SuccessChartsLazy
          bookingsPerWeek={data.charts.bookingsPerWeek}
          bookingsPerMonth={data.charts.bookingsPerMonth}
          ratingTrend={data.charts.ratingTrend}
          completedJobsTrend={data.charts.completedJobsTrend}
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <ActivityTimeline items={data.activity} />
          <LeaderboardCard
            level={data.level}
            dalilyScore={data.kpis.dalilyScore}
            averageRating={data.kpis.averageRating}
            completedJobs={data.kpis.completedJobs}
            badges={data.badges}
          />
        </div>
        <AchievementsPanel achievements={data.achievements} />
      </section>
    </div>
  );
}
