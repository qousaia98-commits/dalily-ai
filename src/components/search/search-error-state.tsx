"use client";

import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SearchErrorStateProps = {
  onRetry?: () => void;
};

export function SearchErrorState({ onRetry }: SearchErrorStateProps) {
  const t = useTranslations("search.error");
  const router = useRouter();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      return;
    }
    router.refresh();
  };

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center"
      role="alert"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="size-7 text-destructive" aria-hidden />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <Button type="button" variant="outline" className="rounded-xl" onClick={handleRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}
