"use client";

import { useRouter, usePathname } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReviewSort } from "@/lib/reviews/types";
import { cn } from "@/lib/utils";

const SORTS: ReviewSort[] = [
  "newest",
  "highest",
  "lowest",
  "helpful",
  "verified",
  "photos",
];

type Props = {
  current: ReviewSort;
};

export function ReviewSortSelect({ current }: Props) {
  const t = useTranslations("reviews.sort");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setSort(sort: ReviewSort) {
    const params = new URLSearchParams(searchParams.toString());
    if (sort === "newest") params.delete("reviewSort");
    else params.set("reviewSort", sort);
    params.delete("reviewPage");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap gap-2" role="listbox" aria-label={t("label")}>
      {SORTS.map((sort) => (
        <button
          key={sort}
          type="button"
          role="option"
          aria-selected={current === sort}
          onClick={() => setSort(sort)}
          className={cn(
            "min-h-10 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
            current === sort
              ? "border-[var(--dalily-gold)] bg-[var(--dalily-gold)]/15 text-[var(--dalily-navy)]"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          {t(sort)}
        </button>
      ))}
    </div>
  );
}
