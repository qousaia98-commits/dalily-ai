import { Search, Send, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PatternBackdrop } from "@/components/brand/pattern-backdrop";
import { cn } from "@/lib/utils";

const stepIcons = [Search, Send, ShieldCheck];

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
        <div className="grid gap-8 sm:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = stepIcons[index];
            return (
              <div
                key={step}
                className={cn(
                  "animate-fade-in-up relative flex flex-col items-center rounded-2xl border border-border/70 bg-card p-6 text-center shadow-sm transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-[var(--dalily-gold)]/35 hover:shadow-md motion-reduce:transition-none",
                  `stagger-${index + 1}`,
                )}
              >
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--dalily-gold)_12%,transparent)] text-[var(--dalily-gold)]">
                  <Icon className="size-7" />
                </div>
                <span className="mb-2 text-xs font-bold tracking-wider text-primary uppercase">
                  {t("step", { number: index + 1 })}
                </span>
                <h3 className="mb-2 text-lg font-semibold">{t(`steps.${step}.title`)}</h3>
                <p className="text-sm text-muted-foreground">{t(`steps.${step}.description`)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
