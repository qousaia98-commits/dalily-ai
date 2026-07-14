import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { CategoryIcon } from "@/components/categories/category-icon";
import { localizedField } from "@/lib/categories/format";
import { getCategoryGroups } from "@/lib/categories/queries";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/** Landing page — service groups from the database (not handyman-only). */
export async function CategoryGrid({ className }: { className?: string }) {
  const t = await getTranslations("home");
  const locale = (await getLocale()) as Locale;
  const groups = await getCategoryGroups();

  return (
    <section className={cn("w-full", className)}>
      <h2 className="mb-4 text-center text-lg font-semibold sm:text-start sm:text-xl">
        {t("categoriesTitle")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
        {groups.map((group) => {
          const label = localizedField(group.name, locale);

          return (
            <Link
              key={group.id}
              href={`/search?group=${group.slug}`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-center transition-all hover:border-primary/30 hover:bg-accent/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
              aria-label={t("categorySearchLabel", { category: label })}
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-12">
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
