"use client";

import { useTranslations } from "next-intl";
import { SearchForm } from "@/components/search/search-form";
import { cn } from "@/lib/utils";

export function SearchHero({ className }: { className?: string }) {
  const t = useTranslations("home");

  return (
    <section className={cn("w-full", className)}>
      <div className="relative mx-auto max-w-3xl">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-2xl sm:-inset-8"
        />

        <div className="relative">
          <SearchForm />
          <p className="mt-3 text-center text-sm text-muted-foreground sm:text-start">
            {t("searchHint")}
          </p>
        </div>
      </div>
    </section>
  );
}
