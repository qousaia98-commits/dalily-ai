import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";
import {
  ensureProviderMonetizationPlan,
  getBillingSettings,
  getSubscriptionVisibility,
  SUBSCRIPTION_GRACE_DAYS,
} from "@/lib/monetization";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PatternBackdrop } from "@/components/brand/pattern-backdrop";
import { cn } from "@/lib/utils";

/**
 * Provider subscription status — flat $5/mo model.
 * Payment upload cycle lands in Prompt 12; admins mark paid for now.
 */
export default async function BusinessSubscriptionPage() {
  if (!isProviderMonetizationEnabled()) {
    redirect("/business");
  }

  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) redirect("/business");

  const t = await getTranslations("businessSubscription");
  const [plan, settings] = await Promise.all([
    ensureProviderMonetizationPlan(provider.id),
    getBillingSettings(),
  ]);
  const visibility = getSubscriptionVisibility(plan);

  const phaseKey =
    visibility.phase === "active"
      ? "phase.active"
      : visibility.phase === "grace"
        ? "phase.grace"
        : visibility.phase === "hidden"
          ? "phase.hidden"
          : "phase.unpaid";

  return (
    <main className="relative mx-auto w-full max-w-2xl space-y-6 px-4 py-8 animate-fade-in sm:px-6">
      <PatternBackdrop patternOpacity={0.04} density="sparse" wash={false} />

      <header className="relative space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("subtitle")}</p>
      </header>

      <section
        className={cn(
          "relative space-y-3 rounded-3xl border p-5 sm:p-6",
          visibility.visible
            ? "border-[var(--dalily-gold)]/40 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,transparent)]"
            : "border-border bg-card",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{t("statusLabel")}</p>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              visibility.visible
                ? "bg-[color-mix(in_oklab,var(--dalily-gold)_18%,transparent)] text-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {t(phaseKey)}
          </span>
        </div>

        <p className="text-lg font-semibold tracking-tight">
          {t("price", { price: settings.businessPriceUsd })}
        </p>
        <p className="text-sm text-muted-foreground">{t("unlimitedLeads")}</p>

        {visibility.periodEnd ? (
          <p className="text-sm text-muted-foreground">
            {t("periodEnd", {
              date: new Date(visibility.periodEnd).toLocaleDateString(),
            })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noPeriod")}</p>
        )}

        {visibility.phase === "grace" && visibility.graceDaysRemaining != null ? (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {t("graceRemaining", {
              days: visibility.graceDaysRemaining,
              graceDays: SUBSCRIPTION_GRACE_DAYS,
            })}
          </p>
        ) : null}

        {!visibility.visible ? (
          <p className="text-sm text-muted-foreground">{t("hiddenHint")}</p>
        ) : null}
      </section>

      <section className="relative space-y-3 rounded-3xl border border-border bg-card/80 p-5 sm:p-6">
        <h2 className="text-base font-semibold">{t("paymentTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("paymentBody")}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/business/payments">{t("paymentsHub")}</Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-xl">
            <Link href="/business">{t("backHome")}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
