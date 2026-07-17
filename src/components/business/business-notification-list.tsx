import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Star,
  Crown,
  ShieldCheck,
  MessageCircle,
  MessageSquare,
  Clock3,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import type { BusinessNotification } from "@/lib/business/notification-inbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS = {
  check: CheckCircle2,
  alert: AlertTriangle,
  payment: CreditCard,
  star: Star,
  crown: Crown,
  shield: ShieldCheck,
  message: MessageCircle,
  review: MessageSquare,
  clock: Clock3,
} as const;

export async function BusinessNotificationList({
  items,
  compact = false,
}: {
  items: BusinessNotification[];
  compact?: boolean;
}) {
  const t = await getTranslations("business.messages");

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <Bell className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium text-[var(--dalily-navy)]">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3" aria-label={t("listLabel")}>
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? Bell;
        const content = (
          <article
            className={cn(
              "flex gap-3 rounded-2xl border p-4 transition-colors",
              item.unread
                ? "border-[var(--dalily-gold)]/35 bg-[linear-gradient(180deg,#fff_0%,#FBF8F0_100%)]"
                : "border-[#E8ECF2] bg-white",
            )}
          >
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                item.unread
                  ? "bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--dalily-navy)]">
                  {t(item.titleKey)}
                </h3>
                {item.unread ? (
                  <span className="rounded-full bg-[var(--dalily-navy)] px-2 py-0.5 text-[0.625rem] font-bold text-white">
                    {t("unread")}
                  </span>
                ) : null}
                <span className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t(`sources.${item.source}`)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {item.bodyParams ? t(item.bodyKey, item.bodyParams) : t(item.bodyKey)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          </article>
        );

        if (item.href && !compact) {
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
              >
                {content}
              </Link>
            </li>
          );
        }

        return <li key={item.id}>{content}</li>;
      })}
    </ul>
  );
}

export async function DashboardNotificationsPreview({
  items,
}: {
  items: BusinessNotification[];
}) {
  const t = await getTranslations("business.messages");
  const preview = items.slice(0, 3);

  return (
    <section className="space-y-4" aria-labelledby="dash-messages-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dash-messages-title" className="text-lg font-bold text-[var(--dalily-navy)]">
          {t("previewTitle")}
        </h2>
        <Button asChild variant="outline" className="rounded-2xl">
          <Link href="/business/messages">{t("viewAll")}</Link>
        </Button>
      </div>
      <BusinessNotificationList items={preview} compact />
    </section>
  );
}
