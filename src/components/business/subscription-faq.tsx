"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const FAQ_KEYS = ["active", "pay", "upgrade", "cancel"] as const;

export function SubscriptionFaq() {
  const t = useTranslations("business.subscription.faq");
  const [open, setOpen] = useState<string | null>("active");

  return (
    <section className="mx-auto w-full max-w-2xl space-y-5" aria-labelledby="subscription-faq-title">
      <div className="space-y-2 text-center">
        <h2 id="subscription-faq-title" className="text-2xl font-bold tracking-tight text-[var(--dalily-navy)]">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ul className="divide-y divide-border/70 overflow-hidden rounded-3xl border border-[#E8ECF2] bg-white shadow-[0_12px_36px_-22px_rgba(11,21,38,0.2)]">
        {FAQ_KEYS.map((key) => {
          const isOpen = open === key;
          return (
            <li key={key}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((prev) => (prev === key ? null : key))}
                className="flex min-h-14 w-full items-center justify-between gap-3 px-5 py-4 text-start outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--dalily-gold)]"
              >
                <span className="text-sm font-semibold text-[var(--dalily-navy)] sm:text-base">
                  {t(`items.${key}.q`)}
                </span>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform duration-300",
                    isOpen && "rotate-180",
                    "motion-reduce:transition-none",
                  )}
                  aria-hidden
                />
              </button>
              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-[#5C6478]">{t(`items.${key}.a`)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
