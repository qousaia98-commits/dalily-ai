/** Spacer so page content clears the floating mobile bottom nav. */
export function MobileBottomNavSpacer() {
  return (
    <div
      className="h-[var(--dalily-mobile-nav-offset)] shrink-0 md:hidden"
      aria-hidden
    />
  );
}
