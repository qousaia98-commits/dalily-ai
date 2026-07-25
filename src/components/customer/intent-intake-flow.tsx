"use client";

import { useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Loader2, Camera, MapPin, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  publishIntentRequestAction,
  suggestIntentCategoryAction,
} from "@/actions/intent-request.actions";
import type { CategorySuggestion, IntentUrgency } from "@/domains/customer/intent-types";
import { cn } from "@/lib/utils";

type CityOption = { id: string; slug: string; label: string };
type CategoryOption = { id: string; slug: string; label: string };

type Step = "intent" | "category" | "photos" | "location" | "urgency" | "publish";

export function IntentIntakeFlow({
  initialIntent = "",
  cities,
  loginHref,
  isAuthenticated,
}: {
  initialIntent?: string;
  cities: CityOption[];
  loginHref: string;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("intentFlow");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState<Step>("intent");
  const [intentText, setIntentText] = useState(initialIntent);
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [cityId, setCityId] = useState(cities[0]?.id ?? "");
  const [locationText, setLocationText] = useState("");
  const [urgency, setUrgency] = useState<IntentUrgency>("normal");
  const [needsUrgencyConfirm, setNeedsUrgencyConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(
    () => [t("suggestions.s1"), t("suggestions.s2"), t("suggestions.s3"), t("suggestions.s4")],
    [t],
  );

  function resolveError(code?: string) {
    if (!code) return t("errors.unknown");
    try {
      return t(`errors.${code}` as "errors.unknown");
    } catch {
      return t("errors.unknown");
    }
  }

  function goSuggest() {
    setError(null);
    const text = intentText.trim();
    if (text.length < 8) {
      setError(resolveError("intent_too_short"));
      return;
    }
    startTransition(async () => {
      const result = await suggestIntentCategoryAction(text);
      if (!result.success) {
        setError(resolveError(result.error));
        return;
      }
      setSuggestion(result.suggestion ?? null);
      const opts =
        result.categories?.map((c) => ({
          id: c.id,
          slug: c.slug,
          label: locale === "ar" ? c.labelAr : c.labelEn,
        })) ?? [];
      setCategories(opts);
      if (result.suggestion) {
        setCategoryId(result.suggestion.categoryId);
        const hyp = result.suggestion.hypothesizedUrgency;
        setNeedsUrgencyConfirm(hyp === "emergency");
        setUrgency(hyp === "emergency" ? "emergency" : "normal");
      } else if (opts[0]) {
        setCategoryId(opts[0].id);
        setNeedsUrgencyConfirm(false);
        setUrgency("normal");
      }
      setStep("category");
    });
  }

  function afterCategory() {
    setStep("photos");
  }

  function afterPhotos() {
    setStep("location");
  }

  function afterLocation() {
    if (!cityId) {
      setError(resolveError("location_required"));
      return;
    }
    if (needsUrgencyConfirm) {
      setStep("urgency");
      return;
    }
    setStep("publish");
  }

  function publish() {
    setError(null);
    if (!isAuthenticated) {
      window.location.href = loginHref;
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("intentText", intentText.trim());
      fd.set("categoryId", categoryId);
      fd.set("cityId", cityId);
      fd.set("urgency", urgency);
      if (locationText.trim()) fd.set("locationText", locationText.trim());
      for (const file of photos) fd.append("photos", file);

      const result = await publishIntentRequestAction(fd);
      if (!result.success || !result.requestId) {
        if (result.error === "login_required") {
          window.location.href = loginHref;
          return;
        }
        setError(resolveError(result.error));
        return;
      }
      router.push(`/request/${result.requestId}/waiting`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--dalily-gold)]" aria-hidden />
        <p>{t("trust.privacy")}</p>
      </div>

      {step === "intent" && (
        <section className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="intent">{t("steps.intent.label")}</Label>
            <Textarea
              id="intent"
              value={intentText}
              onChange={(e) => setIntentText(e.target.value)}
              rows={4}
              placeholder={t("steps.intent.placeholder")}
              className="min-h-28 resize-y"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-border/80 bg-background px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                onClick={() => setIntentText(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <Button type="button" className="w-full" disabled={pending} onClick={goSuggest}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : t("steps.intent.continue")}
          </Button>
        </section>
      )}

      {step === "category" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t("steps.category.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("steps.category.subtitle")}</p>
          </div>
          {suggestion && (
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              {t("steps.category.suggested", {
                category: locale === "ar" ? suggestion.labelAr : suggestion.labelEn,
              })}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="category">{t("steps.category.change")}</Label>
            <select
              id="category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">{t("trust.relevantOnly")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("intent")}>
              {t("back")}
            </Button>
            <Button type="button" className="flex-1" disabled={!categoryId} onClick={afterCategory}>
              {t("continue")}
            </Button>
          </div>
        </section>
      )}

      {step === "photos" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t("steps.photos.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("steps.photos.subtitle")}</p>
          </div>
          <Label
            htmlFor="photos"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground hover:border-primary/40"
          >
            <Camera className="size-6" aria-hidden />
            {t("steps.photos.add")}
            <input
              id="photos"
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 5);
                setPhotos(files);
              }}
            />
          </Label>
          {photos.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("steps.photos.count", { count: photos.length })}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("category")}>
              {t("back")}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={afterPhotos}>
              {t("steps.photos.skip")}
            </Button>
            <Button type="button" className="flex-1" onClick={afterPhotos}>
              {t("continue")}
            </Button>
          </div>
        </section>
      )}

      {step === "location" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t("steps.location.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("steps.location.subtitle")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {t("steps.location.city")}
              </span>
            </Label>
            <select
              id="city"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="area">{t("steps.location.areaOptional")}</Label>
            <Textarea
              id="area"
              rows={2}
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              placeholder={t("steps.location.areaPlaceholder")}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("trust.addressLater")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("photos")}>
              {t("back")}
            </Button>
            <Button type="button" className="flex-1" onClick={afterLocation}>
              {t("continue")}
            </Button>
          </div>
        </section>
      )}

      {step === "urgency" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t("steps.urgency.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("steps.urgency.subtitle")}</p>
          </div>
          <div className="grid gap-2">
            {(
              [
                ["emergency", t("steps.urgency.emergency")],
                ["normal", t("steps.urgency.normal")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setUrgency(value)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-start text-sm",
                  urgency === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("location")}>
              {t("back")}
            </Button>
            <Button type="button" className="flex-1" onClick={() => setStep("publish")}>
              {t("continue")}
            </Button>
          </div>
        </section>
      )}

      {step === "publish" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{t("steps.publish.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("steps.publish.subtitle")}</p>
          </div>
          <ul className="space-y-2 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <li>{t("trust.relevantOnly")}</li>
            <li>{t("trust.privacy")}</li>
            <li>{t("trust.youControl")}</li>
            <li>{t("trust.verified")}</li>
          </ul>
          {!isAuthenticated && (
            <p className="text-sm text-amber-700 dark:text-amber-400">{t("steps.publish.loginRequired")}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(needsUrgencyConfirm ? "urgency" : "location")}
            >
              {t("back")}
            </Button>
            <Button type="button" className="flex-1" disabled={pending} onClick={publish}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : t("steps.publish.cta")}
            </Button>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
