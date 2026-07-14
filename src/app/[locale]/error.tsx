"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { DalilyLogo } from "@/components/brand/dalily-logo";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <DalilyLogo variant="full" />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-md text-muted-foreground">{t("description")}</p>
        {process.env.NODE_ENV === "development" && error.message ? (
          <p className="max-w-lg truncate text-xs text-destructive">{error.message}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} size="lg" className="rounded-xl">
          {t("retry")}
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-xl">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
