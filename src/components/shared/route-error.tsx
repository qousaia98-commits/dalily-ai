"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
};

/** Compact in-layout error for nested routes (keeps chrome visible). */
export function RouteError({ error, reset, homeHref = "/" }: Props) {
  const t = useTranslations("error");

  if (process.env.NODE_ENV === "development") {
    console.error("[route]", error);
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-6 px-4 py-16 text-center">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} className="min-h-11 rounded-xl">
          {t("retry")}
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href={homeHref}>{t("backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
