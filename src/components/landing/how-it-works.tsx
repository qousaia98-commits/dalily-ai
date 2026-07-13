import { Search, MessageSquare, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

const stepIcons = [Search, MessageSquare, ShieldCheck];

export async function HowItWorks({ className }: { className?: string }) {
  const t = await getTranslations("home.howItWorks");

  const steps = ["search", "connect", "trust"] as const;

  return (
    <section className={cn("px-4 py-16 sm:px-6 sm:py-20", className)}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
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
                  "animate-fade-in-up relative flex flex-col items-center rounded-2xl border bg-card p-6 text-center shadow-sm",
                  `stagger-${index + 1}`,
                )}
              >
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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
