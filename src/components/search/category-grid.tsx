import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { CategoryIcon } from "@/components/categories/category-icon";
import { localizedField } from "@/lib/categories/format";
import { getCategoryGroups } from "@/lib/categories/queries";
import { logger } from "@/lib/observability/logger";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        {groups.map((group, index) => {
          const label = localizedField(group.name, locale);

          return (
            <Link
              key={group.id}
              href="/request/new"
              className={cn(
                "group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-center transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:border-[var(--dalily-gold)]/40 hover:bg-accent/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 sm:p-5",
                "animate-fade-in-up",
                `stagger-${Math.min(index + 1, 4)}`,
              )}
              aria-label={t("categorySearchLabel", { category: label })}
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-[color-mix(in_oklab,var(--dalily-gold)_16%,transparent)] group-hover:text-[var(--dalily-gold)] sm:size-12">
                <CategoryIcon name={group.icon} className="size-5 sm:size-6" />
              </div>
              <span className="text-sm font-medium sm:text-base">{label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
