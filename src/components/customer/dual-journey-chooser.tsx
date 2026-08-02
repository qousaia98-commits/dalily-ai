"use client";

import { useEffect, useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { ClipboardList, Search, Sparkles, ArrowRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getMarketplacePathRecommendationAction,
  recordDualMarketplaceChoiceAction,
} from "@/actions/dual-marketplace.actions";
import type { MarketplacePathRecommendation } from "@/lib/marketplace/dual/types";

const FILTER_CACHE_KEY = "dalily_dual_intent_draft";

export function DualJourneyChooser({ className }: { className?: string }) {
  const t = useTranslations("dualMarketplace");
  const locale = useLocale();
  const router = useRouter();
  const inputId = useId();
  const [pending, startTransition] = useTransition();
  const [intent, setIntent] = useState("");
  const [recommendation, setRecommendation] =
    useState<MarketplacePathRecommendation | null>(null);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(FILTER_CACHE_KEY);
      if (cached) setIntent(cached);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const q = intent.trim();
    try {
      if (q) sessionStorage.setItem(FILTER_CACHE_KEY, q);
      else sessionStorage.removeItem(FILTER_CACHE_KEY);
    } catch {
      // ignore
    }

    if (q.length < 4) {
      setRecommendation(null);
      return;
    }

    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const rec = await getMarketplacePathRecommendationAction(q);
        setRecommendation(rec);
      });
    }, 320);

    return () => window.clearTimeout(handle);
  }, [intent]);

  const recommendedPath = recommendation?.path ?? null;

  const reason = useMemo(() => {
    if (!recommendation) return null;
    return locale === "ar" ? recommendation.reasonAr : recommendation.reasonEn;
  }, [locale, recommendation]);

  function go(path: "publish" | "find") {
    const q = intent.trim();
    startTransition(async () => {
      await recordDualMarketplaceChoiceAction({
        path,
        recommendedPath,
        intentText: q,
      });
      if (path === "publish") {
        router.push(
          q.length >= 4
            ? `/request/new?q=${encodeURIComponent(q)}&mode=publish`
            : "/request/new?mode=publish",
        );
      } else {
        router.push(
          q.length >= 2
            ? `/request/new?q=${encodeURIComponent(q)}&from=dual`
            : "/request/new?from=dual",
        );
      }
    });
  }

  return (
    <section className={cn("w-full max-w-3xl space-y-4", className)}>
      <div className="rounded-3xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <label htmlFor={inputId} className="sr-only">
          {t("intentLabel")}
        </label>
        <Textarea
          id={inputId}
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={3}
          placeholder={t("intentPlaceholder")}
          dir={locale === "ar" ? "rtl" : "ltr"}
          className="min-h-[5.5rem] resize-y border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
        />

        {reason ? (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[var(--dalily-gold)]/30 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,transparent)] px-3 py-2.5">
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-[var(--dalily-gold)]"
              aria-hidden
            />
            <div className="min-w-0 space-y-0.5 text-start">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("aiSuggests")}
              </p>
              <p className="text-sm text-foreground">{reason}</p>
              <p className="text-[0.7rem] text-muted-foreground">
                {t("canIgnore")}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <PathCard
          recommended={recommendedPath === "publish"}
          title={t("publish.title")}
          body={t("publish.body")}
          icon={<ClipboardList className="size-5" aria-hidden />}
          cta={t("publish.cta")}
          pending={pending}
          onClick={() => go("publish")}
        />
        <PathCard
          recommended={recommendedPath === "find"}
          title={t("find.title")}
          body={t("find.body")}
          icon={<Search className="size-5" aria-hidden />}
          cta={t("find.cta")}
          pending={pending}
          onClick={() => go("find")}
        />
      </div>
    </section>
  );
}

function PathCard({
  title,
  body,
  icon,
  cta,
  recommended,
  pending,
  onClick,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  cta: string;
  recommended: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("dualMarketplace");
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-3 rounded-3xl border bg-card p-5 text-start",
        "transition-[border-color,box-shadow,transform,opacity] duration-200 ease-out",
        "hover:border-[var(--dalily-gold)]/50 hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]/60",
        "active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
        recommended
          ? "border-[var(--dalily-gold)]/55 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]"
          : "border-border/80",
        pending && "opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-muted text-foreground">
          {icon}
        </span>
        {recommended ? (
          <span className="rounded-full border border-[var(--dalily-gold)]/40 bg-[var(--dalily-gold)]/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
            {t("recommended")}
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold tracking-tight">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
        {cta}
        <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5 motion-reduce:transition-none" />
      </span>
    </button>
  );
}
