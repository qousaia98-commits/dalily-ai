import { getTranslations } from "next-intl/server";
import type { ProviderPrepSummary } from "@/lib/ai/jobs/types";

/**
 * AI preparation card shown to providers before composing an offer.
 */
export async function JobPrepSummary({
  prep,
}: {
  prep: ProviderPrepSummary;
}) {
  const t = await getTranslations("offerFlow.provider.prep");

  return (
    <section
      className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-3"
      aria-label={t("title")}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("badge")}
        </p>
        <h2 className="text-sm font-semibold">{t("title")}</h2>
      </div>

      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("duration")}</dt>
          <dd className="font-medium text-end">{prep.durationLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("complexity")}</dt>
          <dd className="font-medium text-end capitalize">{prep.complexity}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{t("priceRange")}</dt>
          <dd className="font-medium text-end">{prep.priceRangeLabel}</dd>
        </div>
        {prep.vision ? (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("imageConfidence")}</dt>
              <dd className="font-medium text-end">
                {Math.round(prep.vision.imageConfidence * 100)}%
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{t("estimatedRisk")}</dt>
              <dd className="font-medium text-end capitalize">
                {prep.vision.estimatedRisk}
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      {prep.vision?.detectedObjects.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("detectedObjects")}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {prep.vision.detectedObjects.map((obj) => (
              <li
                key={obj}
                className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[0.7rem]"
              >
                {obj.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prep.vision?.likelyDamage.length ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {t("likelyDamage")}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {prep.vision.likelyDamage.map((d) => (
              <li
                key={d}
                className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[0.7rem]"
              >
                {d.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prep.tools.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("tools")}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {prep.tools.map((tool) => (
              <li
                key={tool}
                className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[0.7rem]"
              >
                {tool.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prep.materials.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("materials")}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {prep.materials.map((m) => (
              <li
                key={m}
                className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[0.7rem]"
              >
                {m.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {prep.relatedTrades.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("relatedTrades")}</p>
          <p className="mt-0.5 text-sm">{prep.relatedTrades.join(" · ")}</p>
        </div>
      ) : null}

      {prep.vision?.contradiction ? (
        <p className="text-[0.7rem] leading-relaxed text-amber-700 dark:text-amber-400">
          {t("visionMismatch")}
        </p>
      ) : null}

      <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
        {prep.disclaimer}
      </p>
    </section>
  );
}
