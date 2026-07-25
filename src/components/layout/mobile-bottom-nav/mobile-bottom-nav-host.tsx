import { MobileBottomNav } from "./mobile-bottom-nav";
import { getMobileNavBadges } from "./get-mobile-nav-badges";
import type { MobileNavRole } from "./types";

type MobileBottomNavHostProps = {
  role: MobileNavRole;
  marketplaceHome?: boolean;
  showOpportunities?: boolean;
  showUnlock?: boolean;
};

export async function MobileBottomNavHost({
  role,
  marketplaceHome = false,
  showOpportunities = false,
  showUnlock = false,
}: MobileBottomNavHostProps) {
  const badges = await getMobileNavBadges(role);
  return (
    <MobileBottomNav
      role={role}
      badges={badges}
      marketplaceHome={marketplaceHome}
      showOpportunities={showOpportunities}
      showUnlock={showUnlock}
    />
  );
}
