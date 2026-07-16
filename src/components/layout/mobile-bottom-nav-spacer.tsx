/** Spacer so page content clears the floating mobile bottom nav. */
export function MobileBottomNavSpacer() {
  return (
    <div
      className="h-[calc(5.25rem+env(safe-area-inset-bottom))] shrink-0 md:hidden"
      aria-hidden
    />
  );
}
