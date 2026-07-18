"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import { useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { localizedField } from "@/lib/categories/format";
import type { CategoryGroupWithLeaves } from "@/lib/categories/types";
import type { Locale } from "@/lib/i18n/config";
import { CITY_IDS } from "@/lib/constants/reference-data";
import { cn } from "@/lib/utils";

type SearchFiltersProps = {
  groups: CategoryGroupWithLeaves[];
  className?: string;
  nearbyAvailable?: boolean;
};

export function SearchFilters({
  groups,
  className,
  nearbyAvailable = false,
}: SearchFiltersProps) {
  const t = useTranslations("search.filters");
  const tCities = useTranslations("auth.cities");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      if (key === "category") params.delete("group");
      if (key === "group") params.delete("category");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const category = searchParams.get("category") ?? searchParams.get("group") ?? "all";
  const city = searchParams.get("city") ?? "all";
  const verified = searchParams.get("verified") ?? "all";
  const nearby = searchParams.get("nearby") ?? "city";
  const sort = searchParams.get("sort") ?? "relevant";

  return (
    <aside className={cn("space-y-5", className)}>
      <div>
        <h2 className="mb-4 text-sm font-semibold">{t("title")}</h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search-category">{t("category")}</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                if (v === "all") {
                  updateParam("category", null);
                  updateParam("group", null);
                  return;
                }
                if (groups.some(({ group }) => group.slug === v)) {
                  updateParam("group", v);
                } else {
                  updateParam("category", v);
                }
              }}
            >
              <SelectTrigger id="search-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                {groups.map(({ group, leaves }) => (
                  <SelectGroup key={group.id}>
                    <SelectLabel>{localizedField(group.name, locale)}</SelectLabel>
                    <SelectItem value={group.slug}>
                      {t("allInGroup", { group: localizedField(group.name, locale) })}
                    </SelectItem>
                    {leaves.map((leaf) => (
                      <SelectItem key={leaf.id} value={leaf.slug}>
                        {localizedField(leaf.name, locale)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search-city">{t("city")}</Label>
            <Select
              value={city}
              onValueChange={(v) => updateParam("city", v === "all" ? null : v)}
            >
              <SelectTrigger id="search-city">
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
            <Label htmlFor="nearby-radius">{t("nearby")}</Label>
            <Select
              value={nearbyAvailable ? nearby : "city"}
              onValueChange={(v) => updateParam("nearby", v === "city" ? null : v)}
              disabled={!nearbyAvailable}
            >
              <SelectTrigger id="nearby-radius">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">{t("nearbyOptions.3")}</SelectItem>
                <SelectItem value="5">{t("nearbyOptions.5")}</SelectItem>
                <SelectItem value="10">{t("nearbyOptions.10")}</SelectItem>
                <SelectItem value="20">{t("nearbyOptions.20")}</SelectItem>
                <SelectItem value="city">{t("nearbyOptions.city")}</SelectItem>
              </SelectContent>
            </Select>
            {!nearbyAvailable ? (
              <p className="text-xs text-muted-foreground">{t("nearbyNeedsLocation")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="search-sort">{t("sort")}</Label>
            <Select
              value={sort}
              onValueChange={(v) => updateParam("sort", v === "relevant" ? null : v)}
            >
              <SelectTrigger id="search-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevant">{t("sortOptions.relevant")}</SelectItem>
                <SelectItem value="nearest">{t("sortOptions.nearest")}</SelectItem>
                <SelectItem value="rating">{t("sortOptions.rating")}</SelectItem>
                <SelectItem value="newest">{t("sortOptions.newest")}</SelectItem>
                <SelectItem value="pro">{t("sortOptions.pro")}</SelectItem>
                <SelectItem value="premium">{t("sortOptions.premium")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search-verified">{t("verified")}</Label>
            <Select
              value={verified}
              onValueChange={(v) => updateParam("verified", v === "all" ? null : v)}
            >
              <SelectTrigger id="search-verified">
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
