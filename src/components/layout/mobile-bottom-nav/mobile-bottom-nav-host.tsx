import { MobileBottomNav } from "./mobile-bottom-nav";
import { getMobileNavBadges } from "./get-mobile-nav-badges";
import type { MobileNavRole } from "./types";

type MobileBottomNavHostProps = {
  role: MobileNavRole;
};

export async function MobileBottomNavHost({ role }: MobileBottomNavHostProps) {
  const badges = await getMobileNavBadges(role);
  return <MobileBottomNav role={role} badges={badges} />;
}
