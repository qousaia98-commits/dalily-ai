"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Check, Loader2, MapPin } from "lucide-react";
import { saveOnboardingProfileAction } from "@/actions/provider.actions";
import { CategorySelect } from "@/components/categories/category-select";
import { FieldError } from "@/components/forms/field-error";
import { useClientFormValidation } from "@/hooks/use-client-form-validation";
import type { CategoryGroupWithLeaves } from "@/lib/categories/types";
import type { ManagedProvider } from "@/types/provider.types";
import { getLocalizedField } from "@/types/provider.types";
import { CITY_IDS } from "@/lib/constants/reference-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function citySlugFromId(cityId: string): string {
  const entry = Object.entries(CITY_IDS).find(([, id]) => id === cityId);
  return entry?.[0] ?? "damascus";
}

type Props = {
  provider: ManagedProvider;
  categoryGroups: CategoryGroupWithLeaves[];
  categorySlug: string;
  onBack: () => void;
  onFinished: () => void;
};

export function OnboardingProfileStep({
  provider,
  categoryGroups,
  categorySlug,
  onBack,
  onFinished,
}: Props) {
  const t = useTranslations("business.onboarding.profile");
  const tc = useTranslations("auth.cities");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [businessName, setBusinessName] = useState(
    getLocalizedField(provider.name, locale as "ar" | "en"),
  );
  const [about, setAbout] = useState(
    getLocalizedField(provider.about, locale as "ar" | "en"),
  );
  const [phone, setPhone] = useState(provider.phone ?? "");
  const [address, setAddress] = useState(
    getLocalizedField(provider.addressLine, locale as "ar" | "en"),
  );
  const [category, setCategory] = useState(categorySlug);
  const [city, setCity] = useState(citySlugFromId(provider.cityId));
  const {
    fieldErrors,
    validateForm,
    getFieldA11y,
    requiredAttr,
    clearFieldError,
  } = useClientFormValidation({ formId: "onboarding-profile" });

  function persist() {
    const form = formRef.current;
    if (!form) return;

    const fd = new FormData(form);
    setSaveState("saving");
    setError(null);

    startTransition(async () => {
      const result = await saveOnboardingProfileAction({ success: false }, fd);
      if (!result.success) {
        setSaveState("error");
        setError(t("errors.validation"));
        return;
      }
      setSaveState("saved");
    });
  }

  function scheduleAutosave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(), 700);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleFinish() {
    const form = formRef.current;
    if (!form) return;
    if (!validateForm(form)) return;

    const fd = new FormData(form);
    setError(null);

    startTransition(async () => {
      const result = await saveOnboardingProfileAction({ success: false }, fd);
      if (!result.success) {
        setError(t("errors.validation"));
        return;
      }
      onFinished();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center sm:text-start">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)] sm:mx-0">
          <Building2 className="size-7" aria-hidden />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--dalily-navy)]">{t("title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </div>

      <form
        ref={formRef}
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          handleFinish();
        }}
      >
        <input type="hidden" name="locale" value={locale} />

        <div className="space-y-1.5">
          <Label htmlFor="onboard-name">{t("businessName")}</Label>
          <Input
            id="onboard-name"
            name="businessName"
            value={businessName}
            onChange={(e) => {
              setBusinessName(e.target.value);
              clearFieldError("businessName");
              scheduleAutosave();
            }}
            minLength={2}
            className="h-12 rounded-xl"
            {...requiredAttr}
            {...getFieldA11y("businessName")}
          />
          <FieldError
            name="businessName"
            formId="onboarding-profile"
            message={fieldErrors.businessName}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboard-category">{t("category")}</Label>
          <input type="hidden" name="category" value={category} />
          <CategorySelect
            id="onboard-category"
            groups={categoryGroups}
            value={category}
            onValueChange={(value) => {
              setCategory(value);
              scheduleAutosave();
            }}
            placeholder={t("categoryPlaceholder")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboard-phone">{t("phone")}</Label>
          <Input
            id="onboard-phone"
            name="phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearFieldError("phone");
              scheduleAutosave();
            }}
            minLength={7}
            className="h-12 rounded-xl"
            {...requiredAttr}
            {...getFieldA11y("phone")}
          />
          <FieldError name="phone" formId="onboarding-profile" message={fieldErrors.phone} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboard-about">{t("description")}</Label>
          <Textarea
            id="onboard-about"
            name="about"
            value={about}
            onChange={(e) => {
              setAbout(e.target.value);
              clearFieldError("about");
              scheduleAutosave();
            }}
            minLength={10}
            rows={4}
            className="rounded-xl"
            {...requiredAttr}
            {...getFieldA11y("about")}
          />
          <FieldError name="about" formId="onboarding-profile" message={fieldErrors.about} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboard-city">{t("city")}</Label>
          <input type="hidden" name="city" value={city} />
          <Select
            value={city}
            onValueChange={(value) => {
              setCity(value);
              scheduleAutosave();
            }}
          >
            <SelectTrigger id="onboard-city" className="h-12 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(CITY_IDS).map((slug) => (
                <SelectItem key={slug} value={slug}>
                  {tc(slug as "damascus")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="onboard-address">{t("address")}</Label>
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="onboard-address"
              name="address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                clearFieldError("address");
                scheduleAutosave();
              }}
              minLength={3}
              className="h-12 rounded-xl ps-10"
              placeholder={t("addressPlaceholder")}
              {...requiredAttr}
              {...getFieldA11y("address")}
            />
          </div>
          <FieldError name="address" formId="onboarding-profile" message={fieldErrors.address} />
        </div>

        <div className="flex min-h-5 items-center justify-center gap-1.5 text-xs text-muted-foreground">
          {saveState === "saving" || pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {t("saving")}
            </>
          ) : saveState === "saved" ? (
            <>
              <Check className="size-3.5 text-emerald-600" aria-hidden />
              {t("saved")}
            </>
          ) : (
            t("autosaveHint")
          )}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="min-h-12 rounded-2xl"
            disabled={pending}
            onClick={onBack}
          >
            {t("back")}
          </Button>
          <Button
            type="submit"
            className="min-h-12 rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)] sm:min-w-44"
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : t("finish")}
          </Button>
        </div>
      </form>
    </div>
  );
}
