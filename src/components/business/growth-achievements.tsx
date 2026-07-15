import { getTranslations } from "next-intl/server";
import type { Achievement } from "@/lib/business/achievements";
import { Award, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export async function GrowthAchievements({ achievements }: { achievements: Achievement[] }) {
  const t = await getTranslations("business.growth.achievements");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--dalily-navy)]">{t("title")}</h2>
        <p className="mt-1 text-sm text-[#5C6478]">{t("subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {achievements.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-2xl border p-4 transition duration-300",
              item.unlocked
                ? "border-[var(--dalily-gold)]/40 bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)] shadow-sm"
                : "border-[#E8ECF2] bg-[#F7F8FA] opacity-80",
            )}
          >
            <div className="flex items-center gap-2">
              {item.unlocked ? (
                <Award className="size-5 text-[var(--dalily-gold)]" />
              ) : (
                <Lock className="size-4 text-muted-foreground" />
              )}
              <p className="text-sm font-bold text-[var(--dalily-navy)]">{t(`${item.id}.title`)}</p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[#5C6478]">{t(`${item.id}.body`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
