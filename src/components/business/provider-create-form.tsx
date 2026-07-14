"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createProviderAction, type ProviderActionState } from "@/actions/provider.actions";
import { LocalizedFieldInput } from "@/components/business/localized-field-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategorySelect } from "@/components/categories/category-select";
import type { CategoryGroupWithLeaves } from "@/lib/categories/types";
import { CITY_IDS } from "@/lib/constants/reference-data";
import type { Locale } from "@/lib/i18n/config";

const initialState: ProviderActionState = { success: false };

type ProviderCreateFormProps = {
  categoryGroups: CategoryGroupWithLeaves[];
};

export function ProviderCreateForm({ categoryGroups }: ProviderCreateFormProps) {
  const t = useTranslations("business.create");
  const tCities = useTranslations("auth.cities");
  const locale = useLocale() as Locale;
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [state, formAction, isPending] = useActionState(createProviderAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="city" value={city} />
          <LocalizedFieldInput
            id="businessName"
            name="businessName"
            label={t("name")}
            required
            disabled={isPending}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("category")}</Label>
              <CategorySelect
                groups={categoryGroups}
                value={category}
                onValueChange={setCategory}
                placeholder={t("selectCategory")}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("city")}</Label>
              <Select value={city} onValueChange={setCity} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCity")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(CITY_IDS).map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {tCities(slug)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" name="phone" type="tel" required disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" name="email" type="email" required disabled={isPending} />
            </div>
          </div>
          <LocalizedFieldInput
            id="about"
            name="about"
            label={t("about")}
            multiline
            rows={4}
            required
            disabled={isPending}
          />
          {state.error ? (
            <p className="text-sm text-destructive">{t(`errors.${state.error}` as "errors.unknown")}</p>
          ) : null}
          {state.success ? (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{t("success")}</p>
          ) : null}
          <Button type="submit" disabled={isPending || !category || !city} className="gap-2">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
