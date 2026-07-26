"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  Loader2,
  Camera,
  MapPin,
  ShieldCheck,
  Check,
  Pencil,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  publishIntentRequestAction,
  suggestIntentCategoryAction,
} from "@/actions/intent-request.actions";
import type { CategorySuggestion, IntentUrgency } from "@/domains/customer/intent-types";
import { getContextualSuggestionKeys } from "@/lib/intent/contextual-suggestions";
import { cn } from "@/lib/utils";

type CityOption = { id: string; slug: string; label: string };
type CategoryOption = { id: string; slug: string; label: string };

type Step =
  | "intent"
  | "confirm"
  | "category"
  | "clarify"
  | "photos"
  | "location"
  | "urgency"
  | "publish";

/** Lightweight category-specific clarifying prompts (no LLM at render time). */
const CLARIFY_BY_SLUG: Record<string, string[]> = {
  electrical: ["clarify.electrical.scope", "clarify.electrical.safety"],
  plumbing: ["clarify.plumbing.where", "clarify.plumbing.severity"],
  hvac: ["clarify.hvac.symptom", "clarify.hvac.age"],
  carpentry: ["clarify.carpentry.item", "clarify.carpentry.urgency"],
  painting: ["clarify.painting.indoor", "clarify.painting.size"],
  locksmith: ["clarify.locksmith.lockedOut", "clarify.locksmith.break"],
};

const HIGH_CONFIDENCE = 0.45;

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
  const [clarifyNotes, setClarifyNotes] = useState<string[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  /** Live category from existing suggestIntentCategoryAction (debounced). */
  const [liveCategorySlug, setLiveCategorySlug] = useState<string | null>(null);

  const resolvedCategorySlug =
    liveCategorySlug ??
    suggestion?.categorySlug ??
    categories.find((c) => c.id === categoryId)?.slug ??
    null;

  const suggestions = useMemo(() => {
    const keys = getContextualSuggestionKeys(resolvedCategorySlug);
    return keys.map((key) => t(key as "suggestions.contextual.general.g1"));
  }, [resolvedCategorySlug, t]);

  useEffect(() => {
    const text = intentText.trim();
    if (text.length < 8) {
      setLiveCategorySlug(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const result = await suggestIntentCategoryAction(text);
        if (cancelled) return;
        setLiveCategorySlug(result.suggestion?.categorySlug ?? null);
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [intentText]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const categoryLabel =
    selectedCategory?.label ||
    (suggestion
      ? locale === "ar"
        ? suggestion.labelAr
        : suggestion.labelEn
      : "");

  const cityLabel = cities.find((c) => c.id === cityId)?.label ?? "";

  function resolveError(code?: string) {
    if (!code) return t("errors.unknown");
    try {
      return t(`errors.${code}` as "errors.unknown");
    } catch {
      return t("errors.unknown");
    }
  }

  function loadClarifyForCategory(slug: string | undefined) {
    const keys = (slug && CLARIFY_BY_SLUG[slug]) || [];
    setClarifyNotes(keys.slice(0, 2));
    setClarifyAnswers({});
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
        setLiveCategorySlug(result.suggestion.categorySlug);
        const hyp = result.suggestion.hypothesizedUrgency;
        setNeedsUrgencyConfirm(hyp === "emergency");
        setUrgency(hyp === "emergency" ? "emergency" : "normal");
        loadClarifyForCategory(result.suggestion.categorySlug);
        if (result.suggestion.confidence >= HIGH_CONFIDENCE) {
          setStep("confirm");
        } else {
          setStep("category");
        }
      } else if (opts[0]) {
        setCategoryId(opts[0].id);
        setNeedsUrgencyConfirm(false);
        setUrgency("normal");
        loadClarifyForCategory(opts[0].slug);
        setStep("category");
      } else {
        setStep("category");
      }
    });
  }

  function acceptSuggestion() {
    if (clarifyNotes.length > 0) {
      setStep("clarify");
      return;
    }
    setStep("photos");
  }

  function rejectSuggestion() {
    setStep("category");
  }

  function afterCategory() {
    const slug = categories.find((c) => c.id === categoryId)?.slug;
    loadClarifyForCategory(slug);
    if (slug && CLARIFY_BY_SLUG[slug]?.length) {
      setStep("clarify");
      return;
    }
    setStep("photos");
  }

  function afterClarify() {
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

  function composedIntent(): string {
    const base = intentText.trim();
    const extras = Object.values(clarifyAnswers)
      .map((v) => v.trim())
      .filter(Boolean);
    if (extras.length === 0) return base;
    return `${base}\n\n${extras.join(" · ")}`;
  }

  function publish() {
    setError(null);
    if (!isAuthenticated) {
      window.location.href = loginHref;
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("intentText", composedIntent());
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

  const stepIndex = (
    ["intent", "confirm", "category", "clarify", "photos", "location", "urgency", "publish"] as Step[]
  ).indexOf(step);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 animate-fade-in">
      <div className="flex items-start gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--dalily-gold)]" aria-hidden />
        <p>{t("trust.privacy")}</p>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.max(1, stepIndex + 1)}
        aria-valuemin={1}
        aria-valuemax={6}
      >
        <div
          className="h-full rounded-full bg-[var(--dalily-gold)] transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, ((stepIndex + 1) / 7) * 100)}%` }}
        />
      </div>

      {step === "intent" && (
        <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="intent" className="text-base font-semibold">
              {t("steps.intent.label")}
            </Label>
            <Textarea
              id="intent"
              value={intentText}
              onChange={(e) => setIntentText(e.target.value)}
              rows={4}
              placeholder={t("steps.intent.placeholder")}
              className="min-h-28 resize-y rounded-2xl text-base focus-visible:ring-[var(--dalily-gold)]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs text-muted-foreground transition hover:border-[var(--dalily-gold)]/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setIntentText(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <Button
            type="button"
            className="min-h-11 w-full rounded-xl"
            disabled={pending}
            onClick={goSuggest}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : t("steps.intent.continue")}
          </Button>
        </section>
      )}

      {step === "confirm" && suggestion && (
        <section className="space-y-5 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6 animate-fade-in-up">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dalily-gold)]/30 bg-[color-mix(in_oklab,var(--dalily-gold)_10%,transparent)] px-3 py-1 text-xs font-semibold">
            <Sparkles className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
            {t("steps.confirm.badge")}
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {t("steps.confirm.title", {
                category: locale === "ar" ? suggestion.labelAr : suggestion.labelEn,
              })}
            </h2>
            <p className="text-sm text-muted-foreground">{t("steps.confirm.subtitle")}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              className="min-h-12 rounded-xl gap-2"
              disabled={pending}
              onClick={acceptSuggestion}
            >
              <Check className="size-4" aria-hidden />
              {t("steps.confirm.yes")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 rounded-xl gap-2"
              onClick={rejectSuggestion}
            >
              <Pencil className="size-4" aria-hidden />
              {t("steps.confirm.no")}
            </Button>
          </div>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("intent")}>
            {t("back")}
          </Button>
        </section>
      )}

      {step === "category" && (
        <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">{t("steps.category.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("steps.category.subtitle")}</p>
          </div>
          {suggestion && (
            <p className="rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm">
              {t("steps.category.suggested", {
                category: locale === "ar" ? suggestion.labelAr : suggestion.labelEn,
              })}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="category">{t("steps.category.change")}</Label>
            <select
              id="category"
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                const slug = categories.find((c) => c.id === e.target.value)?.slug;
                setLiveCategorySlug(slug ?? null);
                loadClarifyForCategory(slug);
              }}
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
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStep("intent")}>
              {t("back")}
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1 rounded-xl"
              disabled={!categoryId}
              onClick={afterCategory}
            >
              {t("continue")}
            </Button>
          </div>
        </section>
      )}

      {step === "clarify" && (
        <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">{t("steps.clarify.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("steps.clarify.subtitle")}</p>
          </div>
          {clarifyNotes.map((key, index) => (
            <div key={key} className="space-y-2">
                  <Label htmlFor={`clarify-${index}`}>
                    {t(key as "clarify.electrical.scope")}
                  </Label>
              <Textarea
                id={`clarify-${index}`}
                rows={2}
                className="rounded-2xl"
                value={clarifyAnswers[index] ?? ""}
                onChange={(e) =>
                  setClarifyAnswers((prev) => ({ ...prev, [index]: e.target.value }))
                }
                placeholder={t("steps.clarify.placeholder")}
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setStep(suggestion?.confidence && suggestion.confidence >= HIGH_CONFIDENCE ? "confirm" : "category")}
            >
              {t("back")}
            </Button>
            <Button type="button" variant="secondary" className="flex-1 rounded-xl" onClick={afterClarify}>
              {t("steps.clarify.skip")}
            </Button>
            <Button type="button" className="flex-1 rounded-xl" onClick={afterClarify}>
              {t("continue")}
            </Button>
          </div>
        </section>
      )}

      {step === "photos" && (
        <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-lg font-semibold">{t("steps.photos.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("steps.photos.subtitle")}</p>
          </div>
          <Label
            htmlFor="photos"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-sm text-muted-foreground transition hover:border-[var(--dalily-gold)]/50 hover:bg-muted/20"
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
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setStep(clarifyNotes.length ? "clarify" : "category")}
            >
              {t("back")}
            </Button>
            <Button type="button" variant="secondary" className="flex-1 rounded-xl" onClick={afterPhotos}>
              {t("steps.photos.skip")}
            </Button>
            <Button type="button" className="flex-1 rounded-xl" onClick={afterPhotos}>
              {t("continue")}
            </Button>
          </div>
        </section>
      )}

      {step === "location" && (
        <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
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
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              className="rounded-2xl"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("trust.addressLater")}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStep("photos")}>
              {t("back")}
            </Button>
            <Button type="button" className="min-h-11 flex-1 rounded-xl" onClick={afterLocation}>
              {t("continue")}
            </Button>
          </div>
        </section>
      )}

      {step === "urgency" && (
        <section className="space-y-4 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
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
                  "rounded-2xl border px-4 py-3.5 text-start text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  urgency === value
                    ? "border-[var(--dalily-gold)] bg-[color-mix(in_oklab,var(--dalily-gold)_10%,transparent)]"
                    : "border-border hover:border-primary/30",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setStep("location")}>
              {t("back")}
            </Button>
            <Button type="button" className="min-h-11 flex-1 rounded-xl" onClick={() => setStep("publish")}>
              {t("continue")}
            </Button>
          </div>
        </section>
      )}

      {step === "publish" && (
        <section className="space-y-5 rounded-3xl border border-border/80 bg-card p-5 shadow-sm sm:p-6 animate-fade-in-up">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{t("steps.publish.reviewTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("steps.publish.reviewSubtitle")}</p>
          </div>

          <dl className="space-y-3 rounded-2xl border border-border/70 bg-muted/15 px-4 py-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("steps.publish.fields.category")}</dt>
              <dd className="font-medium text-end">{categoryLabel || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border/50 pt-3">
              <dt className="text-muted-foreground">{t("steps.publish.fields.problem")}</dt>
              <dd className="max-w-[65%] text-end font-medium leading-relaxed">{intentText.trim()}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border/50 pt-3">
              <dt className="text-muted-foreground">{t("steps.publish.fields.location")}</dt>
              <dd className="text-end font-medium">
                {cityLabel}
                {locationText.trim() ? ` · ${locationText.trim()}` : ""}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border/50 pt-3">
              <dt className="text-muted-foreground">{t("steps.publish.fields.urgency")}</dt>
              <dd className="font-medium">
                {urgency === "emergency"
                  ? t("steps.urgency.emergency")
                  : t("steps.urgency.normal")}
              </dd>
            </div>
            {photos.length > 0 ? (
              <div className="flex justify-between gap-3 border-t border-border/50 pt-3">
                <dt className="text-muted-foreground">{t("steps.publish.fields.photos")}</dt>
                <dd className="font-medium">{t("steps.photos.count", { count: photos.length })}</dd>
              </div>
            ) : null}
          </dl>

          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>{t("trust.relevantOnly")}</li>
            <li>{t("trust.youControl")}</li>
          </ul>

          {!isAuthenticated && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              {t("steps.publish.loginRequired")}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-xl gap-2"
              onClick={() => setStep("intent")}
            >
              <Pencil className="size-3.5" aria-hidden />
              {t("steps.publish.edit")}
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-1 rounded-xl"
              disabled={pending}
              onClick={publish}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : t("steps.publish.cta")}
            </Button>
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
