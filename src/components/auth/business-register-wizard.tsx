"use client";

import { useActionState, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { registerBusinessAction, type AuthActionState } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CategorySelect } from "@/components/categories/category-select";
import type { CategoryGroupWithLeaves } from "@/lib/categories/types";
import { localizedField } from "@/lib/categories/format";
import { CITY_IDS } from "@/lib/constants/reference-data";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/i18n/routing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STEPS = ["business", "contact", "services", "review"] as const;
const initialState: AuthActionState = { success: false };

const CITY_SLUGS = Object.keys(CITY_IDS) as string[];

const KNOWN_BUSINESS_ERRORS = new Set([
  "validation_error",
  "password_mismatch",
  "email_taken",
  "weak_password",
  "unknown",
]);

function resolveError(t: ReturnType<typeof useTranslations>, code?: string): string | null {
  if (!code) return null;
  if (!KNOWN_BUSINESS_ERRORS.has(code)) return code;
  const key = `errors.${code}` as "errors.unknown";
  try {
    return t(key);
  } catch {
    return t("errors.unknown");
  }
}

export function BusinessRegisterWizard({
  categoryGroups,
}: {
  categoryGroups: CategoryGroupWithLeaves[];
}) {
  const t = useTranslations("auth.businessWizard");
  const tCities = useTranslations("auth.cities");
  const locale = useLocale() as Locale;
  const [step, setStep] = useState(0);
  const [state, formAction, isPending] = useActionState(registerBusinessAction, initialState);

  const [form, setForm] = useState({
    businessName: "",
    category: "",
    city: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
    about: "",
    services: "",
  });

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const selectedCategory = categoryGroups
    .flatMap((group) => group.leaves)
    .find((leaf) => leaf.slug === form.category);

  const canNext = () => {
    if (step === 0)
      return (
        form.businessName.trim() &&
        form.category &&
        form.city &&
        form.password.length >= 6 &&
        form.password === form.confirmPassword
      );
    if (step === 1) return form.phone.trim() && form.email.trim();
    if (step === 2) return form.about.trim().length >= 10;
    return true;
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const errorMessage = resolveError(t, state.error);

  if (state.success && state.message === "verify_email_business") {
    return (
      <Card className="w-full max-w-lg animate-fade-in-up">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 className="size-12 text-emerald-600" />
          <h2 className="text-xl font-semibold">{t("success.verifyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("success.verifyDescription")}</p>
          <Button asChild variant="outline">
            <Link href="/login">{t("goToLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg animate-fade-in-up">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
        <div className="flex gap-2 pt-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {t("step", { current: step + 1, total: STEPS.length })} — {t(`steps.${STEPS[step]}`)}
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="businessName" value={form.businessName} />
          <input type="hidden" name="category" value={form.category} />
          <input type="hidden" name="city" value={form.city} />
          <input type="hidden" name="phone" value={form.phone} />
          <input type="hidden" name="email" value={form.email} />
          <input type="hidden" name="password" value={form.password} />
          <input type="hidden" name="confirmPassword" value={form.confirmPassword} />
          <input type="hidden" name="about" value={form.about} />
          <input type="hidden" name="services" value={form.services} />

          {step === 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="businessName">{t("businessName")}</Label>
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("category")}</Label>
                <CategorySelect
                  groups={categoryGroups}
                  value={form.category}
                  onValueChange={(v) => update("category", v)}
                  placeholder={t("selectCategory")}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("city")}</Label>
                <Select
                  value={form.city}
                  onValueChange={(v) => update("city", v)}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectCity")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CITY_SLUGS.map((slug) => (
                      <SelectItem key={slug} value={slug}>
                        {tCities(slug as "damascus")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  disabled={isPending}
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => update("confirmPassword", e.target.value)}
                  disabled={isPending}
                  minLength={6}
                />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  disabled={isPending}
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="about">{t("about")}</Label>
                <Textarea
                  id="about"
                  rows={4}
                  value={form.about}
                  onChange={(e) => update("about", e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="services">{t("services")}</Label>
                <Textarea
                  id="services"
                  rows={3}
                  placeholder={t("servicesPlaceholder")}
                  value={form.services}
                  onChange={(e) => update("services", e.target.value)}
                  disabled={isPending}
                />
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">{t("businessName")}: </span>
                {form.businessName}
              </p>
              <p>
                <span className="text-muted-foreground">{t("category")}: </span>
                {selectedCategory ? localizedField(selectedCategory.name, locale) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">{t("city")}: </span>
                {form.city ? tCities(form.city as "damascus") : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">{t("phone")}: </span>
                {form.phone}
              </p>
              <p>
                <span className="text-muted-foreground">{t("email")}: </span>
                {form.email}
              </p>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {state.failedStep ? (
            <p className="text-xs text-destructive/80" role="status">
              Failed step: {state.failedStep}
              {state.error ? ` — ${state.error}` : ""}
            </p>
          ) : null}

          {state.issues && state.issues.length > 0 ? (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
              role="alert"
            >
              <p className="mb-2 font-medium">Validation issues (development)</p>
              <ul className="space-y-1">
                {state.issues.map((issue) => (
                  <li key={`${issue.field}-${issue.code}`}>
                    <span className="font-mono">{issue.field}</span>
                    {" → "}
                    {issue.message}
                    <span className="text-destructive/70"> ({issue.code})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex justify-between gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={back}
              disabled={step === 0 || isPending}
              className="gap-2"
            >
              <ChevronLeft className="size-4" />
              {t("back")}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} disabled={!canNext() || isPending} className="gap-2">
                {t("next")}
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={!canNext() || isPending} className="gap-2">
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {t("finish")}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
