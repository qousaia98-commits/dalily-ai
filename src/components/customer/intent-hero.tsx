"use client";

import { type FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function IntentHero({ className }: { className?: string }) {
  const t = useTranslations("intentFlow");
  const router = useRouter();
  const [value, setValue] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    const href = q.length >= 8 ? `/request/new?q=${encodeURIComponent(q)}` : "/request/new";
    router.push(href);
  }

  return (
    <section className={className}>
      <form onSubmit={onSubmit} className="relative mx-auto max-w-3xl space-y-3">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          placeholder={t("hero.placeholder")}
          className="min-h-24 resize-y text-base"
          aria-label={t("hero.placeholder")}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-[var(--dalily-gold)]" aria-hidden />
            {t("trust.privacy")}
          </p>
          <Button type="submit" className="sm:min-w-40">
            {t("hero.cta")}
          </Button>
        </div>
      </form>
    </section>
  );
}
