import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SearchHero } from "@/components/search/search-hero";
import { CategoryGrid } from "@/components/search/category-grid";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeaturedProviders } from "@/components/landing/featured-providers";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <main className="flex flex-1 flex-col">
        <section className="border-b border-border/60 px-4 pb-14 pt-10 sm:px-6 sm:pb-16 sm:pt-14">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 text-center sm:gap-9">
            <span className="animate-fade-in-up inline-flex items-center gap-1.5 rounded-full border border-[var(--dalily-gold)]/35 bg-[color-mix(in_oklab,var(--dalily-gold)_10%,transparent)] px-3.5 py-1.5 text-xs font-semibold text-foreground sm:text-sm">
              <ShieldCheck className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
              {t("trustBadge")}
            </span>

            <div className="animate-fade-in-up stagger-1 space-y-3">
              <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                {t("heroTitle")}
              </h1>
              <p className="text-balance mx-auto max-w-xl text-base text-muted-foreground sm:text-lg">
                {t("heroSubtitle")}
              </p>
            </div>

            <SearchHero className="animate-fade-in-up stagger-2 w-full max-w-3xl" />
          </div>
        </section>

        <HowItWorks />

        <section className="border-y border-border/60 bg-muted/20 px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <CategoryGrid />
          </div>
        </section>

        <FeaturedProviders />
      </main>
    </>
  );
}
