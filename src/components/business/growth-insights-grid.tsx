import { getTranslations } from "next-intl/server";
import type { WeeklyInsights } from "@/lib/business/insights";
import { Eye, Heart, MessageCircle, Phone, Search, Star } from "lucide-react";

const METRICS = [
  { key: "profileViews", icon: Eye, field: "profileViews" as const },
  { key: "phoneClicks", icon: Phone, field: "phoneClicks" as const },
  { key: "whatsappClicks", icon: MessageCircle, field: "whatsappClicks" as const },
  { key: "favorites", icon: Heart, field: "favorites" as const },
  { key: "reviews", icon: Star, field: "reviews" as const },
  { key: "searchAppearances", icon: Search, field: "searchAppearances" as const },
] as const;

export async function GrowthInsightsGrid({ insights }: { insights: WeeklyInsights }) {
  const t = await getTranslations("business.growth.insights");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--dalily-navy)]">{t("title")}</h2>
        <p className="mt-1 text-sm text-[#5C6478]">{t("subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map(({ key, icon: Icon, field }) => {
          const value = insights[field];
          const empty = value === null;
          return (
            <div
              key={key}
              className="rounded-2xl border border-[#E8ECF2] bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-2 text-[var(--dalily-gold)]">
                <Icon className="size-4" aria-hidden />
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t(key)}
                </p>
              </div>
              {empty ? (
                <p className="mt-3 text-sm leading-relaxed text-[#5C6478]">{t("empty")}</p>
              ) : (
                <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--dalily-navy)]">
                  {value}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
