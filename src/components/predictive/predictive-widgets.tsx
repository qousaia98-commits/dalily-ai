import { getLocale, getTranslations } from "next-intl/server";
import type { WaitTimeEstimate } from "@/lib/ai/predictive/types";
import type { PredictiveNotification } from "@/lib/ai/predictive/types";

export async function WaitTimeCard({ estimate }: { estimate: WaitTimeEstimate }) {
  const t = await getTranslations("predictive.wait");
  const locale = await getLocale();
  const isAr = locale === "ar";

  return (
    <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("badge")}
      </p>
      <p className="text-sm font-medium">
        {isAr ? estimate.labelAr : estimate.labelEn}
      </p>
      <p className="text-[0.7rem] text-muted-foreground">
        {t("confidence", { pct: Math.round(estimate.confidence * 100) })}
      </p>
    </div>
  );
}

export async function PredictiveNotificationsList({
  items,
}: {
  items: PredictiveNotification[];
}) {
  const t = await getTranslations("predictive.notifications");
  const locale = await getLocale();
  const isAr = locale === "ar";
  if (!items.length) return null;

  return (
    <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("title")}
      </p>
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id ?? n.type} className="text-sm">
            <p className="font-medium">{isAr ? n.titleAr : n.titleEn}</p>
            <p className="text-xs text-muted-foreground">
              {isAr ? n.bodyAr : n.bodyEn}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
