import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser } from "@/lib/auth/roles";
import { getBusinessHeaderLabel } from "@/lib/business/header-label";
import { getOwnedProvider } from "@/lib/providers/queries";
import { BusinessSidebar } from "@/components/business/business-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { MobileBottomNavHost } from "@/components/layout/mobile-bottom-nav";
import { MobileBottomNavSpacer } from "@/components/layout/mobile-bottom-nav-spacer";
import type { Locale } from "@/lib/i18n/config";

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const authUser = await getAuthUser();

  if (!authUser) {
    redirect({ href: "/login", locale });
  } else if (!isBusinessUser(authUser.roles)) {
    redirect({ href: "/register/business", locale });
  } else {
    const t = await getTranslations("business.header");
    const provider = await getOwnedProvider(authUser.id);
    const businessLabel = getBusinessHeaderLabel(provider, locale, t("fallback"));

    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader businessLabel={businessLabel} />
        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6">
          <BusinessSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
        <MobileBottomNavSpacer />
        <MobileBottomNavHost role="business" />
      </div>
    );
  }
}
