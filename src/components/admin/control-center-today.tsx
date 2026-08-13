import { getTranslations } from "next-intl/server";
import {
  Building2,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  MessageCircle,
  FileWarning,
  ArrowRight,
} from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { ControlCenterOverview } from "@/lib/admin/control-center";
import { NavCountBadge } from "@/components/shared/nav-count-badge";
import { cn } from "@/lib/utils";

type CardDef = {
  key: string;
  href: string;
  count: number;
  icon: typeof Building2;
  accent?: boolean;
};

export async function ControlCenterToday({ overview }: { overview: ControlCenterOverview }) {
  const t = await getTranslations("admin.controlCenter.today");

  const cards: CardDef[] = [
    {
      key: "businesses",
      href: "/admin/providers?status=pending_review",
      count: overview.pendingBusinesses,
      icon: Building2,
      accent: overview.pendingBusinesses > 0,
    },
    {
      key: "verification",
      href: "/admin/verification",
      count: overview.pendingVerifications,
      icon: ShieldCheck,
      accent: overview.pendingVerifications > 0,
    },
    {
      key: "payments",
      href: "/admin/payments?tab=pending_review",
      count: overview.pendingPayments,
      icon: CreditCard,
      accent: overview.pendingPayments > 0,
    },
    {
      key: "issues",
      href: "/admin/issues",
      count: overview.openIssues,
      icon: AlertTriangle,
      accent: overview.openIssues > 0,
    },
    {
      key: "messages",
      href: "/admin/messages",
      count: overview.unreadMessages,
      icon: MessageCircle,
      accent: overview.unreadMessages > 0,
    },
    {
      key: "changes",
      href: "/admin/providers?status=changes_requested",
      count: overview.changesRequested,
      icon: FileWarning,
      accent: overview.changesRequested > 0,
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="ops-today-title">
      <div>
        <h2
          id="ops-today-title"
          className="text-lg font-bold tracking-tight text-foreground sm:text-xl"
        >
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.key}
              href={card.href}
              className={cn(
                "group flex min-h-[5.5rem] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4",
                "shadow-sm transition-[transform,border-color,box-shadow] duration-200",
                "hover:-translate-y-0.5 hover:border-[var(--dalily-gold)]/45 hover:shadow-md",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
                "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                card.accent &&
                  "border-[var(--dalily-gold)]/35 bg-[linear-gradient(160deg,var(--card)_0%,rgba(212,175,55,0.07)_100%)]",
              )}
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                  card.accent
                    ? "bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{t(`cards.${card.key}`)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("open")}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <NavCountBadge count={card.count} />
                <ArrowRight
                  className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180"
                  aria-hidden
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
