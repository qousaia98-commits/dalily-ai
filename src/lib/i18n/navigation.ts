import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * App navigation APIs (Link, redirect, hooks).
 * Import these from `@/lib/i18n/navigation` — never from a shared barrel with middleware.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
