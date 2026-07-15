import { getTranslations } from "next-intl/server";
import type { PlanSlug } from "@/lib/subscription/types";

export async function GrowthHero({
  planSlug,
  businessName,
}: {
  planSlug: PlanSlug;
  businessName: string;
}) {
  const t = await getTranslations("business.growth.hero");
  const tier = planSlug === "premium" ? "premium" : planSlug === "pro" ? "pro" : "starter";

  return (
    <header className="overflow-hidden rounded-3xl border border-[#E8ECF2] bg-[linear-gradient(180deg,#fff_0%,#F7F8FA_100%)] p-6 sm:p-8">
      <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-4xl">
        {t(`${tier}.title`, { name: businessName })}
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#5C6478] sm:text-lg">
        {t(`${tier}.subtitle`)}
      </p>
    </header>
  );
}
