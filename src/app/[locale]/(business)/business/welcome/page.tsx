import { getLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/lib/i18n/routing";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { getSubscriptionPageData } from "@/actions/subscription.actions";
import { BusinessSubscriptionPanel } from "@/components/business/business-subscription-panel";
import { Button } from "@/components/ui/button";
import type { PlanSlug } from "@/lib/subscription/types";
import { ArrowRight, BadgeCheck, Sparkles, TrendingUp } from "lucide-react";

export default async function BusinessWelcomePage() {
  const t = await getTranslations("business.welcome");
  const locale = await getLocale();
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    redirect({ href: "/business", locale: locale as "ar" | "en" });
  }

  const { subscription, payments, pendingPayment } = await getSubscriptionPageData(authUser.id);

  const nextSteps = [
    { icon: BadgeCheck, title: t("steps.verification.title"), body: t("steps.verification.body") },
    { icon: TrendingUp, title: t("steps.growth.title"), body: t("steps.growth.body") },
    { icon: Sparkles, title: t("steps.plans.title"), body: t("steps.plans.body") },
  ] as const;

  return (
    <div className="w-full max-w-full space-y-10 overflow-x-hidden animate-fade-in py-2">
      <div className="mx-auto max-w-2xl text-center">
        <div
          className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-[var(--dalily-gold)]/15 text-3xl"
          aria-hidden
        >
          🎉
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-[var(--dalily-navy)] sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#5C6478] sm:text-lg">{t("subtitle")}</p>
      </div>

      <section className="mx-auto max-w-3xl rounded-3xl border border-[#E8ECF2] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-bold text-[var(--dalily-navy)]">{t("nextTitle")}</h2>
        <ul className="mt-5 space-y-4">
          {nextSteps.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dalily-navy)]/5 text-[var(--dalily-navy)]">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-semibold text-[var(--dalily-navy)]">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[#5C6478]">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <Button
          asChild
          className="mt-6 h-12 w-full rounded-2xl bg-[var(--dalily-gold)] font-bold text-[var(--dalily-navy)] hover:bg-[var(--dalily-gold-light)] sm:w-auto"
        >
          <Link href="/business/profile" className="gap-2">
            {t("completeProfile")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold tracking-[0.14em] text-[var(--dalily-gold)] uppercase">
          {t("discoverEyebrow")}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--dalily-navy)]">{t("discoverTitle")}</h2>
        <p className="mt-2 text-sm text-[#5C6478]">{t("discoverSubtitle")}</p>
      </div>

      <BusinessSubscriptionPanel
        currentPlanSlug={(subscription?.planSlug ?? "free") as PlanSlug}
        status={subscription?.status ?? "active"}
        expiresAt={subscription?.expiresAt ?? null}
        pendingPayment={pendingPayment}
        payments={payments}
        mode="welcome"
      />
    </div>
  );
}
