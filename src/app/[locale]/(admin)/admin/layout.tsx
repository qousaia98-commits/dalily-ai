import { getLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { canAccessAdminPanel, isPlatformAdmin } from "@/lib/auth/roles";
import { getAdminUnreadBadgeCounts } from "@/lib/admin/nav-badges";
import { AdminControlShell } from "@/components/admin/admin-control-shell";
import { AppHeader } from "@/components/layout/app-header";
import { MobileBottomNavHost } from "@/components/layout/mobile-bottom-nav";
import { MobileBottomNavSpacer } from "@/components/layout/mobile-bottom-nav-spacer";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect({ href: "/login", locale });
  } else if (!canAccessAdminPanel(authUser.roles)) {
    redirect({ href: "/", locale });
  } else {
    const badges = await getAdminUnreadBadgeCounts();
    const isFullAdmin = isPlatformAdmin(authUser.roles);

    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-8 sm:px-6">
          <AdminControlShell badges={badges} showAdminOnly={isFullAdmin}>
            {children}
          </AdminControlShell>
        </div>
        <MobileBottomNavSpacer />
        <MobileBottomNavHost role="admin" />
      </div>
    );
  }
}
