import { getLocale, getTranslations } from "next-intl/server";
import { optimizeProviderDay } from "@/lib/booking/smart/day-optimize";

export async function DayOptimizePanel({ providerId }: { providerId: string }) {
  const t = await getTranslations("booking.optimize");
  const locale = await getLocale();
  const plan = await optimizeProviderDay({ providerId });

  return (
    <section className="space-y-3 rounded-3xl border border-border bg-card p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("badge")}
        </p>
        <h2 className="text-lg font-bold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">
          {locale === "ar" ? plan.summaryAr : plan.summaryEn}
        </p>
      </div>
      {plan.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="space-y-2">
          {plan.items.map((item) => (
            <li
              key={item.bookingId}
              className="rounded-xl border border-border/60 px-3 py-2 text-sm"
            >
              <p className="font-medium">
                {item.suggestedOrder}. {item.title}
              </p>
              <p className="text-xs text-muted-foreground">{item.noteEn}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
