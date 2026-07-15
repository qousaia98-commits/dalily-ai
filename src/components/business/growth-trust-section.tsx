import { getTranslations } from "next-intl/server";
import { Eye, ShieldCheck, Sparkles, BarChart3, Users } from "lucide-react";

const REASONS = [
  { key: "visibility", icon: Eye },
  { key: "trust", icon: ShieldCheck },
  { key: "ai", icon: Sparkles },
  { key: "insights", icon: BarChart3 },
  { key: "growth", icon: Users },
] as const;

export async function GrowthTrustSection() {
  const t = await getTranslations("business.growth.trust");

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--dalily-navy)]/10 bg-[linear-gradient(145deg,#0B1526_0%,#1a2744_100%)] p-6 text-white shadow-[0_16px_40px_-18px_rgba(11,21,38,0.45)] sm:p-8">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{t("title")}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">{t("subtitle")}</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {REASONS.map(({ key, icon: Icon }) => (
          <div key={key} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <Icon className="size-5 text-[var(--dalily-gold)]" />
            <p className="mt-3 text-sm font-bold">{t(`${key}.title`)}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/65">{t(`${key}.body`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
