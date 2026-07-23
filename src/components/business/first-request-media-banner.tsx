"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { PartyPopper, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  providerId: string;
  totalRequests: number;
  galleryCount: number;
};

const storageKey = (providerId: string) => `dalily-first-request-media-${providerId}`;

export function FirstRequestMediaBanner({
  providerId,
  totalRequests,
  galleryCount,
}: Props) {
  const t = useTranslations("business.dashboard.firstRequest");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (totalRequests < 1 || galleryCount > 0) {
      setVisible(false);
      return;
    }
    try {
      if (window.localStorage.getItem(storageKey(providerId)) === "1") {
        setVisible(false);
        return;
      }
    } catch {
      // ignore storage errors
    }
    setVisible(true);
  }, [providerId, totalRequests, galleryCount]);

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey(providerId), "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[var(--dalily-gold)]/35 bg-[linear-gradient(165deg,#FFFDF8_0%,#F8F1DE_100%)] p-5 sm:p-6"
      aria-labelledby="first-request-title"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute end-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-black/5"
        aria-label={t("dismiss")}
      >
        <X className="size-4" aria-hidden />
      </button>

      <div className="flex items-start gap-3 pe-8">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--dalily-gold)]/20 text-[var(--dalily-navy)]">
          <PartyPopper className="size-5" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2
            id="first-request-title"
            className="text-lg font-bold tracking-tight text-[var(--dalily-navy)]"
          >
            {t("title")}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("hint")}</p>
          <Button
            asChild
            className="mt-2 h-10 rounded-2xl bg-[var(--dalily-navy)] font-semibold text-white hover:bg-[var(--dalily-navy)]/90"
          >
            <Link href="/business/media">{t("cta")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
