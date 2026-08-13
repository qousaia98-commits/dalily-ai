import { LifeBuoy, ArrowLeft, ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

export async function ContactSupportButton() {
  const t = await getTranslations("support");
  const locale = await getLocale();
  const isRtl = locale === "ar";
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  return (
    <Link
      href="/account/support"
      className="group flex min-h-16 items-center gap-4 rounded-2xl border border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))] px-4 py-3.5 shadow-sm transition-colors hover:bg-[color-mix(in_oklab,var(--dalily-gold)_14%,var(--card))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--dalily-gold)] text-[var(--dalily-navy)]">
        <LifeBuoy className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-foreground">{t("navTitle")}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{t("navDesc")}</span>
      </span>
      <Arrow
        className="size-4 shrink-0 text-[var(--dalily-gold)] transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
