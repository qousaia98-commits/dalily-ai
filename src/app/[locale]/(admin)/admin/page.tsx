import { requireAdminUser } from "@/lib/auth/session";
import {
  getControlCenterOverview,
  listAdminActivityFeed,
} from "@/lib/admin/control-center";
import { getMarketplaceInsights } from "@/lib/admin/marketplace-insights";
import { ControlCenterHero } from "@/components/admin/control-center-hero";
import { ControlCenterTasks } from "@/components/admin/control-center-tasks";
import { ControlCenterStats } from "@/components/admin/control-center-stats";
import { ControlCenterActivityFeed } from "@/components/admin/control-center-activity";
import { ControlCenterMarketplace } from "@/components/admin/control-center-marketplace";

export default async function AdminDashboardPage() {
  await requireAdminUser();
  const [overview, activity, marketplace] = await Promise.all([
    getControlCenterOverview(),
    listAdminActivityFeed(12),
    getMarketplaceInsights(),
  ]);

  return (
    <div className="space-y-8 animate-fade-in lg:space-y-10">
      <ControlCenterHero overview={overview} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <ControlCenterTasks overview={overview} />
          <ControlCenterMarketplace insights={marketplace} />
          <ControlCenterStats overview={overview} />
        </div>
        <div className="hidden xl:block">
          <ControlCenterActivityFeed items={activity} />
        </div>
      </div>

      <div className="xl:hidden">
        <ControlCenterActivityFeed items={activity} />
      </div>
    </div>
  );
}
