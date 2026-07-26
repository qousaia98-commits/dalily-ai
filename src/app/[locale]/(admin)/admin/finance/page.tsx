import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { isFinanceDashboardEnabled } from "@/lib/config/feature-flags";
import { computeFinanceDashboardSnapshot } from "@/lib/finance-analytics";
import { AdminFinanceDashboard } from "@/components/admin/admin-finance-dashboard";
import { Link } from "@/lib/i18n/routing";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

export default async function AdminFinancePage() {
  if (!isFinanceDashboardEnabled()) {
    redirect("/admin/payments");
  }

  const admin = await requireAdminUser();
  if (!isPlatformAdmin(admin.roles)) {
    redirect("/admin");
  }

  const t = await getTranslations("admin.finance");
  const snapshot = await computeFinanceDashboardSnapshot({
    actorUserId: admin.id,
  });

  void emitAiLearningEvent({
    eventType: "finance_dashboard_viewed",
    metadata: { anonymized: true, fromCache: snapshot.fromCache },
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t("pageSubtitle")}
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <Link
            href="/admin/payments"
            className="text-[var(--dalily-gold)] hover:underline"
          >
            {t("links.payments")}
          </Link>
          <Link
            href="/admin/refunds"
            className="text-[var(--dalily-gold)] hover:underline"
          >
            {t("links.refunds")}
          </Link>
          <Link
            href="/admin/documents"
            className="text-[var(--dalily-gold)] hover:underline"
          >
            {t("links.documents")}
          </Link>
        </div>
      </div>

      <AdminFinanceDashboard initialSnapshot={snapshot} />
    </div>
  );
}
