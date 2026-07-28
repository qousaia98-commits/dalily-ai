"use client";

import { useLocale } from "next-intl";
import { usePathname } from "@/lib/i18n/navigation";
import { localeNames, type Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();

  const switchLocale = () => {
    const nextLocale: Locale = locale === "ar" ? "en" : "ar";
    // Full navigation keeps NEXT_LOCALE cookie + middleware aligned under
    // localePrefix "as-needed" (soft replace was reverted by Accept-Language).
    const path = pathname || "/";
    const href =
      nextLocale === "en" ? (path === "/" ? "/en" : `/en${path}`) : path === "/" ? "/" : path;
    document.cookie = `NEXT_LOCALE=${nextLocale};path=/;max-age=31536000;samesite=lax`;
    window.location.assign(href);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={switchLocale}
      className={cn("min-w-[4.5rem] font-medium", className)}
      aria-label={localeNames[locale === "ar" ? "en" : "ar"]}
    >
      {locale === "ar" ? "EN" : "عر"}
    </Button>
  );
}
