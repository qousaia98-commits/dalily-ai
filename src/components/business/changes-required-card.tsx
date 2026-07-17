import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";

type ChangesRequiredCardProps = {
  note: string;
  href?: string;
};

export async function ChangesRequiredCard({
  note,
  href = "/business/verification",
}: ChangesRequiredCardProps) {
  const t = await getTranslations("business.changesRequired");

  return (
    <div className="rounded-3xl border-2 border-amber-400/50 bg-amber-50 p-6 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-amber-950 dark:text-amber-50">
              {t("title")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-900/80 dark:text-amber-100/80">
              {t("subtitle")}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200/80 bg-white/80 px-4 py-3 dark:border-amber-500/20 dark:bg-black/20">
            <p className="text-xs font-semibold tracking-wide text-amber-800/70 uppercase dark:text-amber-200/70">
              {t("noteLabel")}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-50">
              {note}
            </p>
          </div>
          <Button
            asChild
            className="h-12 rounded-2xl bg-amber-600 font-bold text-white hover:bg-amber-700"
          >
            <Link href={href}>{t("cta")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
