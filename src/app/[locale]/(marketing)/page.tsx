import { ShieldCheck, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SearchHero } from "@/components/search/search-hero";
import { CategoryGrid } from "@/components/search/category-grid";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FeaturedProviders } from "@/components/landing/featured-providers";
import { AppFooter } from "@/components/layout/app-footer";

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <main className="flex flex-1 flex-col">
        <section className="border-b border-border/60 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center sm:gap-10">
            <div className="animate-fade-in-up flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary sm:text-sm">
                <Sparkles className="size-3.5" />
                {t("aiPowered")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground sm:text-sm">
                <ShieldCheck className="size-3.5 text-primary" />
                {t("trustBadge")}
              </span>
            </div>

            <div className="animate-fade-in-up stagger-1 space-y-4">
              <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                {t("heroTitle")}
              </h1>
              <p className="text-balance mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl">
                {t("heroSubtitle")}
              </p>
            </div>

            <SearchHero className="animate-fade-in-up stagger-2 w-full max-w-3xl" />
          </div>
        </section>

        <section className="border-y border-border/60 bg-muted/20 px-4 py-14 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-5xl">
            <CategoryGrid />
          </div>
        </section>

        <HowItWorks />
        <FeaturedProviders />
      </main>
      <AppFooter />
    </>
  );
}
