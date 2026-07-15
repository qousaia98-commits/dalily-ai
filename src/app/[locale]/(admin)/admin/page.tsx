import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { getAdminDashboardStats } from "@/lib/admin/queries";
import { AdminStatGrid } from "@/components/admin/admin-stat-grid";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

export default async function AdminDashboardPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.dashboard");
  const stats = await getAdminDashboardStats();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/admin/payments">{t("quick.payments")}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/admin/verification">{t("quick.verification")}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/admin/providers">{t("quick.providers")}</Link>
          </Button>
        </div>
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
          pendingPayments: t("stats.pendingPayments"),
          pendingVerifications: t("stats.pendingVerifications"),
          recentRegistrations: t("stats.recentRegistrations"),
          recentApprovals: t("stats.recentApprovals"),
          averageHealthScore: t("stats.averageHealthScore"),
        }}
      />
    </div>
  );
}
