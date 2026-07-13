import {
  Droplets,
  Zap,
  Stethoscope,
  Scale,
  Car,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";

const categoryIcons: Record<ServiceCategory, LucideIcon> = {
  plumber: Droplets,
  electrician: Zap,
  doctor: Stethoscope,
  lawyer: Scale,
  mechanic: Car,
  cleaner: Sparkles,
};

export async function CategoryGrid({ className }: { className?: string }) {
  const t = await getTranslations("home");

  return (
    <section className={cn("w-full", className)}>
      <h2 className="mb-4 text-center text-lg font-semibold sm:text-start sm:text-xl">
        {t("categoriesTitle")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {SERVICE_CATEGORIES.map((key) => {
          const Icon = categoryIcons[key];
          const label = t(`categories.${key}`);

          return (
            <Link
              key={key}
              href={`/search?category=${key}`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-center transition-all hover:border-primary/30 hover:bg-accent/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
              aria-label={t("categorySearchLabel", { category: label })}
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 sm:size-12">
                <Icon className="size-5 sm:size-6" aria-hidden />
              </div>
              <span className="text-sm font-medium sm:text-base">{label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
