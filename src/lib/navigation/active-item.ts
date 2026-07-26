/**
 * Shared navigation active-state matching.
 * Pathname is the single source of truth; exactly one item is always active.
 */

export type NavigationMatchItem = {
  id: string;
  href: string;
  /** Only active on this exact path (e.g. home / dashboard roots). */
  exact?: boolean;
  /** Extra prefixes that keep this item active. */
  matchPrefixes?: readonly string[];
};

/**
 * Default fallback when no route matches (documented per role):
 * - Customer / guest mobile: `home` → `/`
 * - Business sidebar / mobile: `dashboard` → `/business` (exact)
 * - Admin sidebar / mobile: `dashboard` → `/admin` (exact)
 *
 * Resolution order: id `home` → id `dashboard` → first `exact` item → items[0].
 */
export function resolveHomeNavigationItem<T extends NavigationMatchItem>(
  items: readonly T[],
): T {
  if (items.length === 0) {
    throw new Error("resolveHomeNavigationItem: navigation items must not be empty");
  }

  const byHomeId = items.find((item) => item.id === "home");
  if (byHomeId) return byHomeId;

  const byDashboardId = items.find((item) => item.id === "dashboard");
  if (byDashboardId) return byDashboardId;

  const exactRoot = items.find((item) => item.exact);
  if (exactRoot) return exactRoot;

  return items[0]!;
}

/**
 * Specificity score for a pathname against one nav target.
 * 0 = no match. Higher = more specific (wins exclusivity).
 */
export function getNavigationMatchScore(
  pathname: string,
  item: NavigationMatchItem,
): number {
  if (item.exact) {
    return pathname === item.href ? item.href.length + 10_000 : 0;
  }

  let best = 0;

  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
    best = Math.max(best, item.href.length);
  }

  for (const prefix of item.matchPrefixes ?? []) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      best = Math.max(best, prefix.length);
    }
  }

  return best;
}

/**
 * Returns the single navigation item that should be active for `pathname`.
 * Always returns exactly one item (never null/undefined).
 * Longest/most specific match wins; on no match, falls back to Home
 * (see {@link resolveHomeNavigationItem}).
 * Existing match scoring is unchanged — fallback only applies when score is 0.
 */
export function getActiveNavigationItem<T extends NavigationMatchItem>(
  pathname: string,
  items: readonly T[],
): T {
  let best: T | null = null;
  let bestScore = 0;

  for (const item of items) {
    const score = getNavigationMatchScore(pathname, item);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  if (bestScore > 0 && best) return best;
  return resolveHomeNavigationItem(items);
}

/** True only when this item is the exclusive active match for the pathname. */
export function isNavigationItemActive(
  pathname: string,
  item: NavigationMatchItem,
  items: readonly NavigationMatchItem[],
): boolean {
  return getActiveNavigationItem(pathname, items).id === item.id;
}
