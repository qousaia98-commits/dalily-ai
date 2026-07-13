"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CITY_IDS } from "@/lib/constants/reference-data";
import { SERVICE_CATEGORIES } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";

type SearchFiltersProps = {
  className?: string;
};

export function SearchFilters({ className }: SearchFiltersProps) {
  const t = useTranslations("search.filters");
  const tCategories = useTranslations("home.categories");
  const tCities = useTranslations("auth.cities");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const category = searchParams.get("category") ?? "all";
  const city = searchParams.get("city") ?? "all";
  const verified = searchParams.get("verified") ?? "all";

  return (
    <aside className={cn("space-y-5", className)}>
      <div>
        <h2 className="mb-4 text-sm font-semibold">{t("title")}</h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("category")}</Label>
            <Select
              value={category}
              onValueChange={(v) => updateParam("category", v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                {SERVICE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {tCategories(cat)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("city")}</Label>
            <Select
              value={city}
              onValueChange={(v) => updateParam("city", v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCities")}</SelectItem>
                {Object.keys(CITY_IDS).map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {tCities(slug)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("verified")}</Label>
            <Select
              value={verified}
              onValueChange={(v) => updateParam("verified", v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allProviders")}</SelectItem>
                <SelectItem value="true">{t("verifiedOnly")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </aside>
  );
}
