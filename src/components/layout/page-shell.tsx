import { AppFooter } from "@/components/layout/app-footer";
import { AppHeader } from "@/components/layout/app-header";
import { MobileBottomNavHost } from "@/components/layout/mobile-bottom-nav";
import { MobileBottomNavSpacer } from "@/components/layout/mobile-bottom-nav-spacer";
import { LocationOnboardingHost } from "@/components/location/location-onboarding-host";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1">{children}</main>
      <AppFooter className="hidden md:block" />
      <MobileBottomNavSpacer />
      <MobileBottomNavHost role="guest" />
      <LocationOnboardingHost />
    </div>
  );
}
