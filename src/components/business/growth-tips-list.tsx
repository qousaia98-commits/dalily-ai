import { Link } from "@/lib/i18n/routing";
import { getTranslations } from "next-intl/server";
import type { GrowthTip } from "@/lib/business/growth-tips";
import { Lightbulb, ArrowRight } from "lucide-react";

export async function GrowthTipsList({ tips }: { tips: GrowthTip[] }) {
  const t = await getTranslations("business.growth.tips");

  if (tips.length === 0) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6">
        <h2 className="text-xl font-bold text-[var(--dalily-navy)]">{t("title")}</h2>
        <p className="mt-2 text-sm text-emerald-800">{t("allDone")}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[var(--dalily-navy)]">{t("title")}</h2>
        <p className="mt-1 text-sm text-[#5C6478]">{t("subtitle")}</p>
      </div>
      <div className="space-y-3">
        {tips.map((tip) => (
          <article
            key={tip.id}
            className="rounded-2xl border border-[#E8ECF2] bg-white p-5 shadow-sm transition duration-300 hover:border-[var(--dalily-gold)]/40"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]">
                <Lightbulb className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[var(--dalily-navy)]">{t(`items.${tip.titleKey}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[#5C6478]">
                  {t(`items.${tip.whyKey}.why`)}
                </p>
                <Link
                  href={tip.href}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--dalily-navy)] hover:underline"
                >
                  {t("cta")}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
