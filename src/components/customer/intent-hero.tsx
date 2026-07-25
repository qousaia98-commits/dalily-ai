"use client";

import { type FormEvent, useId, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function IntentHero({ className }: { className?: string }) {
  const t = useTranslations("intentFlow");
  const locale = useLocale();
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const isEmpty = value.trim().length === 0;
  const showOverlay = isEmpty;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    const href = q.length >= 8 ? `/request/new?q=${encodeURIComponent(q)}` : "/request/new";
    router.push(href);
  }

  return (
    <section className={className}>
      <form
        onSubmit={onSubmit}
        className={cn(
          "relative mx-auto max-w-3xl space-y-3 rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 sm:p-5",
          focused
            ? "border-[var(--dalily-gold)]/45 shadow-[0_12px_40px_-20px_rgba(0,0,0,0.35)]"
            : "border-border/80",
        )}
      >
        <div className="relative">
          {/* Centered empty-state overlay — decorative; real label is on the textarea */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-3 text-center transition-all duration-300 ease-out",
              showOverlay
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1 opacity-0",
            )}
          >
            <p className="text-[1.25rem] font-semibold leading-snug tracking-tight text-foreground sm:text-[1.375rem]">
              {t("hero.overlayTitle")}
            </p>
            <p className="mt-2 max-w-[22rem] text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
              {t("hero.overlaySubtitle")}
            </p>
          </div>

          <Textarea
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={4}
            // Native placeholder empty — visual copy lives in the overlay
            placeholder=""
            dir={locale === "ar" ? "rtl" : "ltr"}
            className={cn(
              "relative z-0 min-h-[8.5rem] resize-y border-0 bg-transparent text-base leading-relaxed shadow-none transition-[color,opacity] duration-300 focus-visible:ring-0 sm:min-h-[9.5rem]",
              locale === "ar" ? "text-right" : "text-left",
              // Hide typed text under the overlay only while empty; keep caret visible when focused
              showOverlay
                ? cn("text-transparent", focused ? "caret-foreground" : "caret-transparent")
                : "text-foreground caret-foreground",
              "px-1 py-3 sm:px-2",
            )}
            aria-label={t("hero.overlayTitle")}
            aria-describedby={`${inputId}-hint`}
          />
          <p id={`${inputId}-hint`} className="sr-only">
            {t("hero.overlaySubtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
            {t("trust.privacy")}
          </p>
          <Button type="submit" className="min-h-11 rounded-xl sm:min-w-40">
            {t("hero.cta")}
          </Button>
        </div>
      </form>
    </section>
  );
}
