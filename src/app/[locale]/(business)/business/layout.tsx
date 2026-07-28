import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/navigation";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser } from "@/lib/auth/roles";
import { getBusinessHeaderLabel } from "@/lib/business/header-label";
import { getOwnedProvider } from "@/lib/providers/database";
import { loadBusinessConversations } from "@/lib/business/load-conversations";
import { BusinessSidebar } from "@/components/business/business-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { MobileBottomNavHost } from "@/components/layout/mobile-bottom-nav";
import { MobileBottomNavSpacer } from "@/components/layout/mobile-bottom-nav-spacer";
import { PlanBadge } from "@/components/shared/plan-badge";
import { getProviderNavBadges } from "@/lib/badges";
import { isOffersV2Enabled, isUnlockV2Enabled, isProviderDashboardV2Enabled } from "@/lib/config/feature-flags";
import type { Locale } from "@/lib/i18n/config";
import type { PlanSlug } from "@/lib/subscription/types";

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

    let planSlug: PlanSlug = "free";
    let badges = {
      messages: 0,
      requests: 0,
      orders: 0,
      opportunities: 0,
      unlock: 0,
      verification: 0,
    };

    if (provider) {
      try {
        const [loaded, navBadges] = await Promise.all([
          loadBusinessConversations(authUser.id),
          getProviderNavBadges(authUser.id),
        ]);
        planSlug = loaded.planSlug;
        badges = {
          messages: navBadges.messages,
          requests: navBadges.requests,
          orders: navBadges.orders,
          opportunities: navBadges.opportunities,
          unlock: navBadges.unlock,
          verification: navBadges.verification,
        };
      } catch {
        planSlug = "free";
      }
    }

    return (
      <div className="flex min-h-screen flex-col bg-background">
        <AppHeader
          businessLabel={businessLabel}
          businessPlanBadge={
            provider ? <PlanBadge planSlug={planSlug} className="hidden lg:inline-flex" /> : null
          }
        />
        <div className="mx-auto flex w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6">
          <BusinessSidebar
            planSlug={planSlug}
            businessName={provider ? businessLabel : null}
            badges={badges}
            showOpportunities={isOffersV2Enabled()}
            showUnlock={isUnlockV2Enabled()}
            marketplaceHome={isProviderDashboardV2Enabled()}
          />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
        <MobileBottomNavSpacer />
        <MobileBottomNavHost
          role="business"
          marketplaceHome={isProviderDashboardV2Enabled()}
          showOpportunities={isOffersV2Enabled()}
          showUnlock={isUnlockV2Enabled()}
        />
      </div>
    );
  }
}
