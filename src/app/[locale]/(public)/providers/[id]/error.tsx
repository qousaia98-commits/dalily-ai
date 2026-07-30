"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

export default function ProviderProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("provider.errors");

  useEffect(() => {
    console.error("[provider-profile]", error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" className="rounded-xl" onClick={reset}>
          {t("retry")}
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/search">{t("backSearch")}</Link>
        </Button>
      </div>
    </main>
  );
}
