import { Search, Send, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PatternBackdrop } from "@/components/brand/pattern-backdrop";
import { cn } from "@/lib/utils";

const stepIcons = [Search, Send, ShieldCheck];

/**
 * Bento how-it-works: step 1 (entry) is a tall start-side cell spanning two rows;
 * steps 2–3 stack as supporting cells. Grid auto-placement mirrors in RTL
 * (start edge = right in Arabic) so the entry step leads reading order.
 */
export async function HowItWorks({ className }: { className?: string }) {
  const t = await getTranslations("home.howItWorks");

  const steps = ["search", "connect", "trust"] as const;

  return (
    <section className={cn("relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20", className)}>
      <PatternBackdrop patternOpacity={0.05} density="sparse" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-12 animate-fade-in-up text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h2>
          <p className="mt-3 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 sm:grid-rows-2 sm:gap-5">
          {steps.map((step, index) => {
            const Icon = stepIcons[index];
            const featured = index === 0;

            return (
              <div
                key={step}
                className={cn(
                  "animate-fade-in-up relative flex flex-col rounded-2xl border p-5 text-start shadow-sm transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-[var(--dalily-gold)]/40 hover:shadow-md motion-reduce:transition-none sm:p-6",
                  `stagger-${index + 1}`,
                  featured
                    ? "dalily-glass sm:row-span-2 sm:justify-center sm:p-8"
                    : "border-border/70 bg-card",
                )}
              >
                <div
                  className={cn(
                    "mb-4 flex items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--dalily-gold)_12%,transparent)] text-[var(--dalily-gold)]",
                    featured ? "size-16 sm:mb-6 sm:size-[4.5rem]" : "size-12",
                  )}
                >
                  <Icon className={featured ? "size-8 sm:size-9" : "size-6"} aria-hidden />
                </div>
                <span className="mb-2 text-xs font-bold tracking-wider text-primary uppercase">
                  {t("step", { number: index + 1 })}
                </span>
                <h3
                  className={cn(
                    "mb-2 font-semibold tracking-tight",
                    featured ? "text-xl sm:text-2xl" : "text-base sm:text-lg",
                  )}
                >
                  {t(`steps.${step}.title`)}
                </h3>
                <p
                  className={cn(
                    "text-muted-foreground",
                    featured ? "max-w-sm text-sm sm:text-base" : "text-sm",
                  )}
                >
                  {t(`steps.${step}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
