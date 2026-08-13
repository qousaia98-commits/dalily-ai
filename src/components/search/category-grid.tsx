import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { CategoryIcon } from "@/components/categories/category-icon";
import { localizedField } from "@/lib/categories/format";
import { getCategoryGroups } from "@/lib/categories/queries";
import { logger } from "@/lib/observability/logger";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Repeating bento unit — every 5th tile (0, 5, 10…) is featured:
 * - sm 4-col: featured spans 2 → row packs as 2+1+1
 * - lg 6-col: featured spans 2 → row packs as 2+1+1+1+1
 * Mobile stays equal 2-col (no span); featured only gets glass + slightly larger icon.
 */
function isFeaturedCategory(index: number): boolean {
  return index % 5 === 0;
}

/** Landing page — service groups from the database (not handyman-only). */
export async function CategoryGrid({ className }: { className?: string }) {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;

  let groups: Awaited<ReturnType<typeof getCategoryGroups>> = [];
  try {
    groups = await getCategoryGroups();
  } catch (error) {
    logger.error("search.category-grid", "getCategoryGroups failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className={cn("w-full", className)}>
      <h2 className="mb-4 animate-fade-in-up text-center text-lg font-semibold sm:text-start sm:text-xl">
        {t("categoriesTitle")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
        {groups.map((group, index) => {
          const label = localizedField(group.name, locale);
          const featured = isFeaturedCategory(index);

          return (
            <Link
              key={group.id}
              href={`/find?group=${encodeURIComponent(group.slug)}`}
              className={cn(
                "group flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border p-4 text-center transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:border-[var(--dalily-gold)]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 sm:min-h-32 sm:p-5",
                "animate-fade-in-up",
                `stagger-${Math.min((index % 4) + 1, 4)}`,
                featured
                  ? cn(
                      "dalily-glass",
                      "sm:col-span-2 sm:min-h-36 sm:flex-row sm:items-center sm:justify-start sm:gap-4 sm:px-6 sm:text-start",
                    )
                  : "border-border/60 bg-card hover:bg-accent/50",
              )}
              aria-label={t("categorySearchLabel", { category: label })}
            >
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-[color-mix(in_oklab,var(--dalily-gold)_16%,transparent)] group-hover:text-[var(--dalily-gold)]",
                  featured ? "size-12 sm:size-14" : "size-11 sm:size-12",
                )}
              >
                <CategoryIcon
                  name={group.icon}
                  className={featured ? "size-6 sm:size-7" : "size-5 sm:size-6"}
                />
              </div>
              <span
                className={cn(
                  "font-medium",
                  featured ? "text-base sm:text-lg" : "text-sm sm:text-base",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
