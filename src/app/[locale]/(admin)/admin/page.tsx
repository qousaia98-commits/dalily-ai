import { requireAdminUser } from "@/lib/auth/session";
import {
  getControlCenterOverview,
  listAdminActivityFeed,
} from "@/lib/admin/control-center";
import { ControlCenterHero } from "@/components/admin/control-center-hero";
import { ControlCenterHealth } from "@/components/admin/control-center-health";
import { ControlCenterToday } from "@/components/admin/control-center-today";
import { ControlCenterPriorities } from "@/components/admin/control-center-priorities";
import { ControlCenterActivityFeed } from "@/components/admin/control-center-activity";
import { ControlCenterQuickActions } from "@/components/admin/control-center-quick-actions";
import type { OpsAttentionCounts } from "@/lib/admin/ops-health";

/**
 * Admin Operations Center home — progressive disclosure over dense KPI grids.
 * Marketplace v2 / feature flags unchanged; read-only overview data.
 */
export default async function AdminDashboardPage() {
  await requireAdminUser();
  const [overview, activity] = await Promise.all([
    getControlCenterOverview(),
    listAdminActivityFeed(5),
  ]);

  const counts: OpsAttentionCounts = {
    pendingBusinesses: overview.pendingBusinesses,
    pendingPayments: overview.pendingPayments,
    pendingVerifications: overview.pendingVerifications,
    openIssues: overview.openIssues,
    changesRequested: overview.changesRequested,
    unreadMessages: overview.unreadMessages,
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 animate-fade-in lg:space-y-10">
      <ControlCenterHero overview={overview} />
      <ControlCenterHealth counts={counts} />
      <ControlCenterToday overview={overview} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div className="space-y-8">
          <ControlCenterPriorities counts={counts} />
          <ControlCenterQuickActions />
        </div>
        <aside className="min-w-0">
          <ControlCenterActivityFeed items={activity} />
        </aside>
      </div>
    </div>
  );
}
