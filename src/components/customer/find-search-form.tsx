"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Option = { slug: string; label: string };

export function FindSearchForm({
  defaultQuery = "",
  defaultCategory = "",
  defaultGroup = "",
  defaultCity = "",
  categories,
  cities,
}: {
  defaultQuery?: string;
  defaultCategory?: string;
  /** Preserved when browsing via homepage group tiles (`?group=`). */
  defaultGroup?: string;
  defaultCity?: string;
  categories: Option[];
  cities: Option[];
}) {
  const t = useTranslations("findFlow");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const q = String(fd.get("q") ?? "").trim();
    const category = String(fd.get("category") ?? "").trim();
    const city = String(fd.get("city") ?? "").trim();
    const group = String(fd.get("group") ?? "").trim();
    if (q) params.set("q", q);
    if (category) {
      params.set("category", category);
    } else if (group) {
      params.set("group", group);
    }
    if (city) params.set("city", city);
    startTransition(() => {
      router.push(params.toString() ? `/find?${params.toString()}` : "/find");
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm"
    >
      {defaultGroup && !defaultCategory ? (
        <input type="hidden" name="group" value={defaultGroup} />
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          defaultValue={defaultQuery}
          placeholder={t("placeholder")}
          className="ps-9"
          minLength={0}
          maxLength={200}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-muted-foreground">{t("filters.category")}</span>
          <select
            name="category"
            defaultValue={defaultCategory}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("filters.anyCategory")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium text-muted-foreground">{t("filters.city")}</span>
          <select
            name="city"
            defaultValue={defaultCity}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t("filters.anyCity")}</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
