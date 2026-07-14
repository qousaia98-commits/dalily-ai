import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { getAdminDashboardStats } from "@/lib/admin/queries";
import { AdminStatGrid } from "@/components/admin/admin-stat-grid";

export default async function AdminDashboardPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.dashboard");
  const stats = await getAdminDashboardStats();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AdminStatGrid
        stats={stats}
        labels={{
          totalProviders: t("stats.totalProviders"),
          activeProviders: t("stats.activeProviders"),
          pendingReviews: t("stats.pendingReviews"),
          rejectedProviders: t("stats.rejectedProviders"),
          totalUsers: t("stats.totalUsers"),
          totalSearches: t("stats.totalSearches"),
          searchesToday: t("stats.searchesToday"),
        }}
      />
    </div>
  );
}
