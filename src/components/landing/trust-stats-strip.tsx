import { getLocale, getTranslations } from "next-intl/server";
import { countActiveVerifiedProviders } from "@/lib/providers/database";
import { countActiveCategoryGroups } from "@/lib/categories/queries";
import { logger } from "@/lib/observability/logger";
import { cn } from "@/lib/utils";

/** Same closed-beta gate as robots/metadata — env truth, not a placeholder metric. */
const CLOSED_BETA = process.env.DALILY_CLOSED_BETA !== "false";

type TrustStat = {
  key: string;
  value: string;
  label: string;
};

/**
 * Homepage trust strip from live DB counts.
 * Hides entirely on query failure or when both counts are zero (no fake numbers).
 */
export async function TrustStatsStrip({ className }: { className?: string }) {
  const t = await getTranslations("home.trustStats");
  const locale = await getLocale();

  let providerCount = 0;
  let categoryCount = 0;

  try {
    [providerCount, categoryCount] = await Promise.all([
      countActiveVerifiedProviders(),
      countActiveCategoryGroups(),
    ]);
  } catch (error) {
    logger.error("landing.trust-stats", "trust stats query failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  if (providerCount === 0 && categoryCount === 0) {
    return null;
  }

  const numberLocale = locale === "ar" ? "ar-SY" : "en-US";
  const stats: TrustStat[] = [];

  if (providerCount > 0) {
    stats.push({
      key: "providers",
      value: providerCount.toLocaleString(numberLocale),
      label: t("providers"),
    });
  }

  if (categoryCount > 0) {
    stats.push({
      key: "categories",
      value: categoryCount.toLocaleString(numberLocale),
      label: t("categories"),
    });
  }

  if (CLOSED_BETA) {
    stats.push({
      key: "beta",
      value: t("closedBetaValue"),
      label: t("closedBeta"),
    });
  }

  return (
    <section
      aria-label={t("ariaLabel")}
      className={cn(
        "relative border-b border-border/60 px-4 py-8 sm:px-6 sm:py-9",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 dalily-section-wash"
      />
      <ul className="relative mx-auto flex max-w-5xl flex-wrap items-stretch justify-center gap-x-8 gap-y-5 sm:gap-x-12">
        {stats.map((stat, index) => (
          <li
            key={stat.key}
            className={cn(
              "animate-fade-in-up flex min-w-[7.5rem] flex-col items-center text-center sm:min-w-[9rem]",
              `stagger-${Math.min(index + 1, 4)}`,
            )}
          >
            <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {stat.value}
            </span>
            <span className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">
              {stat.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
