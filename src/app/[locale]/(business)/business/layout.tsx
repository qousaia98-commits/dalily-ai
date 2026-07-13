import { getLocale } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser } from "@/lib/auth/roles";
import { BusinessSidebar } from "@/components/business/business-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect({ href: "/login", locale });
  } else if (!isBusinessUser(authUser.roles)) {
    redirect({ href: "/register/business", locale });
  } else {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6">
          <BusinessSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    );
  }
}
