"use client";

import { useActionState, useState } from "react";
import { Images, Loader2, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import {
  updateProviderProfileAction,
  updateContactAction,
  updateWorkingHoursAction,
  deleteProviderAction,
  submitProviderForReviewAction,
  type ProviderActionState,
} from "@/actions/provider.actions";
import { LocalizedFieldInput } from "@/components/business/localized-field-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { ManagedProvider } from "@/types/provider.types";
import { getLocalizedField } from "@/types/provider.types";
import type { Locale } from "@/lib/i18n/config";

const initialState: ProviderActionState = { success: false };

function resolveError(t: ReturnType<typeof useTranslations>, code?: string) {
  if (!code) return null;
  try {
    return t(`errors.${code}` as "errors.unknown");
  } catch {
    return t("errors.unknown");
  }
}

type ProviderProfileEditorProps = {
  provider: ManagedProvider;
  categoryGroups: CategoryGroupWithLeaves[];
  initialCategorySlug: string;
  initialCitySlug: string;
};

export function ProviderProfileEditor({
  provider,
  categoryGroups,
  initialCategorySlug,
  initialCitySlug,
}: ProviderProfileEditorProps) {
  const t = useTranslations("business.profile");
  const tCities = useTranslations("auth.cities");
  const tDays = useTranslations("business.workingHours.days");
  const locale = useLocale() as Locale;

  const [category, setCategory] = useState(initialCategorySlug);
  const [city, setCity] = useState(initialCitySlug);
  const [hours, setHours] = useState(provider.workingHours);

  const [profileState, profileAction, profilePending] = useActionState(
    updateProviderProfileAction,
    initialState,
  );
  const [contactState, contactAction, contactPending] = useActionState(
    updateContactAction,
    initialState,
  );
  const [hoursState, hoursAction, hoursPending] = useActionState(
    updateWorkingHoursAction,
    initialState,
  );

  const [deletePending, setDeletePending] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm(t("deleteConfirm"))) return;
    setDeletePending(true);
    const result = await deleteProviderAction();
    setActionMessage(result.success ? t("deleted") : resolveError(t, result.error));
    setDeletePending(false);
  };

  const handleSubmitReview = async () => {
    setSubmitPending(true);
    const result = await submitProviderForReviewAction();
    setActionMessage(result.success ? t("submitted") : resolveError(t, result.error));
    setSubmitPending(false);
  };

  const updateHour = (day: number, patch: Partial<(typeof hours)[0]>) => {
    setHours((prev) => prev.map((h) => (h.dayOfWeek === day ? { ...h, ...patch } : h)));
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1">
          <TabsTrigger value="basic">{t("basicInfo")}</TabsTrigger>
          <TabsTrigger value="contact">{t("contactInfo")}</TabsTrigger>
          <TabsTrigger value="media">{t("media")}</TabsTrigger>
          <TabsTrigger value="hours">{t("workingHours")}</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("basicInfo")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={profileAction} className="space-y-4">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="category" value={category} />
                <input type="hidden" name="city" value={city} />
                <LocalizedFieldInput
                  id="businessName"
                  name="businessName"
                  label={t("name")}
                  defaultValue={getLocalizedField(provider.name, locale)}
                  existingAr={provider.name.ar}
                  existingEn={provider.name.en}
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("category")}</Label>
                    <CategorySelect
                      groups={categoryGroups}
                      value={category}
                      onValueChange={setCategory}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("city")}</Label>
                    <Select value={city} onValueChange={setCity}>
                      <SelectTrigger>
                        <SelectValue />
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
                <LocalizedFieldInput
                  id="about"
                  name="about"
                  label={t("about")}
                  defaultValue={getLocalizedField(provider.about, locale)}
                  existingAr={provider.about?.ar ?? ""}
                  existingEn={provider.about?.en ?? ""}
                  multiline
                  rows={5}
                />
                {profileState.error ? (
                  <p className="text-sm text-destructive">{resolveError(t, profileState.error)}</p>
                ) : null}
                {profileState.success ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("saved")}</p>
                ) : null}
                <Button type="submit" disabled={profilePending} className="gap-2">
                  {profilePending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("save")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("contactInfo")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={contactAction} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("phone")}</Label>
                    <Input id="phone" name="phone" type="tel" defaultValue={provider.phone ?? ""} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">{t("whatsapp")}</Label>
                    <Input
                      id="whatsapp"
                      name="whatsapp"
                      type="tel"
                      defaultValue={provider.whatsapp ?? ""}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("email")}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={provider.email ?? ""}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">{t("website")}</Label>
                    <Input
                      id="website"
                      name="website"
                      type="url"
                      defaultValue={provider.website ?? ""}
                      placeholder="https://"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="addressAr">{t("addressAr")}</Label>
                    <Textarea
                      id="addressAr"
                      name="addressAr"
                      rows={3}
                      defaultValue={provider.addressLine?.ar ?? ""}
                      dir="rtl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addressEn">{t("addressEn")}</Label>
                    <Textarea
                      id="addressEn"
                      name="addressEn"
                      rows={3}
                      defaultValue={provider.addressLine?.en ?? ""}
                    />
                  </div>
                </div>
                {contactState.error ? (
                  <p className="text-sm text-destructive">{resolveError(t, contactState.error)}</p>
                ) : null}
                {contactState.success ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("saved")}</p>
                ) : null}
                <Button type="submit" disabled={contactPending} className="gap-2">
                  {contactPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("save")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("media")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("mediaManageHint")}</p>
              <Button asChild className="gap-2">
                <Link href="/business/media">
                  <Images className="size-4" aria-hidden />
                  {t("openMediaManager")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hours" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("workingHours")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={hoursAction} className="space-y-4">
                <input type="hidden" name="hours" value={JSON.stringify(hours)} />
                <div className="space-y-3">
                  {hours.map((hour) => (
                    <div
                      key={hour.dayOfWeek}
                      className="grid grid-cols-1 items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_auto_auto_auto]"
                    >
                      <span className="text-sm font-medium">{tDays(String(hour.dayOfWeek))}</span>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={hour.isClosed}
                          onChange={(e) =>
                            updateHour(hour.dayOfWeek, { isClosed: e.target.checked })
                          }
                        />
                        {t("closed")}
                      </label>
                      <Input
                        type="time"
                        value={hour.opensAt?.slice(0, 5) ?? ""}
                        disabled={hour.isClosed}
                        onChange={(e) => updateHour(hour.dayOfWeek, { opensAt: e.target.value })}
                      />
                      <Input
                        type="time"
                        value={hour.closesAt?.slice(0, 5) ?? ""}
                        disabled={hour.isClosed}
                        onChange={(e) => updateHour(hour.dayOfWeek, { closesAt: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                {hoursState.error ? (
                  <p className="text-sm text-destructive">{resolveError(t, hoursState.error)}</p>
                ) : null}
                {hoursState.success ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("saved")}</p>
                ) : null}
                <Button type="submit" disabled={hoursPending} className="gap-2">
                  {hoursPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t("save")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{t("dangerZone")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          {provider.status === "draft" ? (
            <Button onClick={handleSubmitReview} disabled={submitPending} className="gap-2">
              {submitPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("submitForReview")}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deletePending}
            className="gap-2"
          >
            {deletePending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {t("deleteProvider")}
          </Button>
        </CardContent>
      </Card>

      {actionMessage ? (
        <p className="text-sm font-medium text-muted-foreground">{actionMessage}</p>
      ) : null}
    </div>
  );
}
