import {
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  Star,
  User,
  Wrench,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { getBenefits } from "@/lib/subscription/benefit-engine";
import type { PlanSlug } from "@/lib/subscription/types";
import { cn } from "@/lib/utils";

type QuickActionKey = "profile" | "services" | "public" | "verification" | "upgrade";

/**
 * Focused quick actions — only what the owner may need to do next.
 */
export async function DashboardQuickActions({
  planSlug,
  publicHref,
  showVerification = false,
}: {
  planSlug: PlanSlug;
  publicHref?: string | null;
  showVerification?: boolean;
}) {
  const t = await getTranslations("business.dashboard.quickActions");
  const benefits = getBenefits(planSlug);
  const showUpgrade = !benefits.canUsePremiumBadge;

  const actions: {
    key: QuickActionKey;
    href: string;
    icon: typeof User;
  }[] = [
    { key: "profile", href: "/business/profile", icon: User },
    { key: "services", href: "/business/services", icon: Wrench },
    {
      key: "public",
      href: publicHref ?? "/search",
      icon: ExternalLink,
    },
  ];

  if (showUpgrade) {
    actions.push({ key: "upgrade", href: "/business/subscription", icon: Star });
  }
  if (showVerification) {
    actions.push({
      key: "verification",
      href: "/business/verification",
      icon: ShieldCheck,
    });
  }

  return (
    <section className="space-y-4" aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className="text-lg font-bold tracking-tight text-foreground">
        {t("title")}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {actions.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className={cn(
              "group flex min-h-[5.5rem] flex-col justify-between rounded-2xl border border-border bg-card p-4",
              "shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[var(--dalily-gold)]/40 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
              "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="mt-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{t(key)}</span>
              <ArrowUpRight
                className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 motion-reduce:opacity-100"
                aria-hidden
              />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
