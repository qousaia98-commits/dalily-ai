"use client";

import { useTranslations } from "next-intl";
import { SearchErrorState } from "@/components/search/search-error-state";

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("search.error");

  if (process.env.NODE_ENV === "development") {
    console.error("[search]", error);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("pageTitle")}</h1>
      </div>
      <SearchErrorState onRetry={reset} />
    </div>
  );
}
