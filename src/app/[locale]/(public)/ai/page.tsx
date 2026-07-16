import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SearchHero } from "@/components/search/search-hero";

export default async function AiSearchPage() {
  const t = await getTranslations("mobilePages.ai");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <div className="space-y-3 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--dalily-gold)_35%,transparent)] bg-[color-mix(in_oklab,var(--dalily-gold)_12%,transparent)] px-3 py-1 text-xs font-medium text-[var(--dalily-gold)]">
          <Sparkles className="size-3.5" aria-hidden />
          {t("eyebrow")}
        </span>
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="text-balance mx-auto max-w-xl text-muted-foreground">{t("subtitle")}</p>
      </div>
      <SearchHero className="w-full" autoFocus />
    </div>
  );
}
