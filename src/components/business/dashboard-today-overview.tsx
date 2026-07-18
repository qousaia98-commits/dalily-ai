import { Eye, Inbox, MessageCircle, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

export type TodayOverviewData = {
  profileViews: number;
  unreadMessages: number;
  pendingRequests: number;
  growthAppearances: number;
};

/**
 * Calm four-card overview — answers "what needs attention today?" in seconds.
 */
export async function DashboardTodayOverview({ data }: { data: TodayOverviewData }) {
  const t = await getTranslations("business.dashboard.todayOverview");

  const cards = [
    {
      key: "requests" as const,
      icon: Inbox,
      value: data.pendingRequests,
      href: "/business/requests" as const,
      emphasize: data.pendingRequests > 0,
    },
    {
      key: "messages" as const,
      icon: MessageCircle,
      value: data.unreadMessages,
      href: "/business/messages" as const,
      emphasize: data.unreadMessages > 0,
    },
    {
      key: "profileViews" as const,
      icon: Eye,
      value: data.profileViews,
      href: "/business/analytics" as const,
      emphasize: false,
    },
    {
      key: "growth" as const,
      icon: TrendingUp,
      value: data.growthAppearances,
      href: "/business/analytics" as const,
      emphasize: false,
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="today-overview-title">
      <div>
        <h2 id="today-overview-title" className="text-lg font-bold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ key, icon: Icon, value, href, emphasize }) => (
          <Link
            key={key}
            href={href}
            className={cn(
              "rounded-2xl border bg-card p-4 shadow-sm",
              "transition duration-200 hover:-translate-y-0.5 hover:border-[var(--dalily-gold)]/35 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
              "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
              emphasize
                ? "border-[var(--dalily-gold)]/45 bg-[color-mix(in_oklab,var(--dalily-gold)_6%,var(--card))]"
                : "border-border",
            )}
          >
            <div className="flex items-center gap-2 text-[var(--dalily-gold)]">
              <Icon className="size-4 shrink-0" aria-hidden />
              <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                {t(key)}
              </p>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {value}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
