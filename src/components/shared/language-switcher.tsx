"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/lib/i18n/routing";
import { localeNames, type Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = () => {
    const nextLocale: Locale = locale === "ar" ? "en" : "ar";
    router.replace(pathname, { locale: nextLocale });
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
