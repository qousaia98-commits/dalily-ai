import type { ProviderSuccessDashboard } from "@/lib/provider-success/types";
import { SuccessKpiGrid } from "@/components/provider-success/success-kpi-grid";
import { TodaySchedule } from "@/components/provider-success/today-schedule";
import { PerformanceCards } from "@/components/provider-success/performance-cards";
import { InsightsPanel } from "@/components/provider-success/insights-panel";
import { ProfileCompletionRing } from "@/components/provider-success/profile-completion-ring";
import { SuccessQuickActions } from "@/components/provider-success/success-quick-actions";
import { ActivityTimeline } from "@/components/provider-success/activity-timeline";
import { NotificationsWidget } from "@/components/provider-success/notifications-widget";
import {
  LeaderboardCard,
  AchievementsPanel,
} from "@/components/provider-success/leaderboard-card";
import { SuccessChartsLazy } from "@/components/provider-success/success-charts-lazy";

type Props = {
  data: ProviderSuccessDashboard;
  showVerify: boolean;
};

/**
 * Provider Success Dashboard — composes independent widgets.
 * Heavy charts are lazy-loaded client-side.
 */
export function ProviderSuccessDashboardView({ data, showVerify }: Props) {
  return (
    <div className="space-y-8">
      <SuccessKpiGrid kpis={data.kpis} />

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <TodaySchedule appointments={data.todaySchedule} />
        <NotificationsWidget
          items={data.notifications}
          unreadCount={data.unreadNotificationCount}
        />
      </div>

      <PerformanceCards metrics={data.performance} />

      <div className="grid gap-8 lg:grid-cols-2">
        <InsightsPanel insights={data.insights} />
        <ProfileCompletionRing
          percent={data.kpis.profileCompletion}
          missing={data.profileMissing}
        />
      </div>

      <SuccessQuickActions showVerify={showVerify} />

      <SuccessChartsLazy
        bookingsPerWeek={data.charts.bookingsPerWeek}
        bookingsPerMonth={data.charts.bookingsPerMonth}
        ratingTrend={data.charts.ratingTrend}
        completedJobsTrend={data.charts.completedJobsTrend}
      />

      <div className="grid gap-8 lg:grid-cols-2">
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
    </div>
  );
}
