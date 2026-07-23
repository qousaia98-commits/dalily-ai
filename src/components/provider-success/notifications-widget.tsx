"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Bell } from "lucide-react";
import type { NotificationWidgetItem } from "@/lib/provider-success/types";
import { cn } from "@/lib/utils";

export function NotificationsWidget({
  items,
  unreadCount,
}: {
  items: NotificationWidgetItem[];
  unreadCount: number;
}) {
  const t = useTranslations("business.success.notifications");

  return (
    <section className="space-y-3" aria-labelledby="notif-widget-title">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-[var(--dalily-gold)]" aria-hidden />
          <h2 id="notif-widget-title" className="text-lg font-bold tracking-tight">
            {t("title")}
          </h2>
        </div>
        {unreadCount > 0 ? (
          <span className="rounded-full bg-[var(--dalily-gold)] px-2 py-0.5 text-xs font-bold text-[var(--dalily-navy)]">
            {unreadCount}
          </span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 6).map((item) => {
            const inner = (
              <div
                className={cn(
                  "rounded-2xl border px-3 py-2",
                  item.read ? "border-border bg-card" : "border-[var(--dalily-gold)]/35 bg-[color-mix(in_oklab,var(--dalily-gold)_6%,var(--card))]",
                )}
              >
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`categories.${item.category}`)}
                </p>
                <p className="text-sm font-medium">{t(`fallback.${item.category}`)}</p>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
