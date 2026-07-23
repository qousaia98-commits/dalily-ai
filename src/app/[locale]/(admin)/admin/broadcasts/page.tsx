import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";
import { listAdminBroadcasts } from "@/lib/admin/broadcasts";
import { AdminBroadcastPanel } from "@/components/admin/admin-broadcast-panel";

export default async function AdminBroadcastsPage() {
  const authUser = await requireAdminUser();
  if (!isPlatformAdmin(authUser.roles)) {
    const locale = await getLocale();
    redirect({ href: "/admin", locale });
  }

  const t = await getTranslations("admin.broadcasts");
  const history = await listAdminBroadcasts(40);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <AdminBroadcastPanel history={history} />
    </div>
  );
}
