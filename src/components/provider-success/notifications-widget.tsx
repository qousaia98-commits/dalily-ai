"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import { Bell } from "lucide-react";
import type { NotificationWidgetItem } from "@/lib/provider-success/types";
import { cn } from "@/lib/utils";
import { markNotificationReadAction } from "@/actions/service-request.actions";

function useNotificationCopy() {
  const tn = useTranslations("notifications");
  const t = useTranslations("business.success.notifications");

  function titleOf(item: NotificationWidgetItem): string {
    if (item.titleKey.includes("verificationApproved")) {
      return tn("verificationApproved.title");
    }
    if (item.titleKey.includes("verificationRejected")) {
      return tn("verificationRejected.title");
    }
    if (item.titleKey.includes("verificationChangesRequested")) {
      return tn("verificationChangesRequested.title");
    }
    if (item.titleKey.includes("verificationResubmitted")) {
      return tn("verificationResubmitted.title");
    }
    if (item.titleKey.includes("adminBroadcast")) {
      const custom = item.bodyParams?.title;
      return typeof custom === "string" && custom.trim()
        ? custom
        : tn("adminBroadcast.title");
    }
    if (item.titleKey.includes("adminWarning")) {
      return tn("adminWarning.title");
    }
    return t(`fallback.${item.category}`);
  }

  function bodyOf(item: NotificationWidgetItem): string {
    if (item.bodyKey.includes("verificationApproved")) {
      return tn("verificationApproved.body");
    }
    if (item.bodyKey.includes("verificationRejected")) {
      return tn("verificationRejected.body");
    }
    if (item.bodyKey.includes("verificationChangesRequested")) {
      return tn("verificationChangesRequested.body");
    }
    if (item.bodyKey.includes("verificationResubmitted")) {
      return tn("verificationResubmitted.body");
    }
    if (item.bodyKey.includes("adminBroadcast")) {
      const custom = item.bodyParams?.body;
      return typeof custom === "string" && custom.trim()
        ? custom
        : tn("adminBroadcast.body");
    }
    if (item.bodyKey.includes("adminWarning")) {
      const msg = item.bodyParams?.message;
      return typeof msg === "string" && msg.trim()
        ? msg
        : tn("adminWarning.body");
    }
    return t(`fallback.${item.category}`);
  }

  return { t, titleOf, bodyOf };
}

export function NotificationsWidget({
  items,
  unreadCount,
}: {
  items: NotificationWidgetItem[];
  unreadCount: number;
}) {
  const { t, titleOf, bodyOf } = useNotificationCopy();

  return (
    <section className="space-y-3" aria-labelledby="notif-widget-title">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative">
            <Bell className="size-5 text-[var(--dalily-gold)]" aria-hidden />
            {unreadCount > 0 ? (
              <span
                className="absolute -end-1 -top-1 size-2.5 rounded-full bg-destructive"
                aria-hidden
              />
            ) : null}
          </span>
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
            const reason =
              typeof item.bodyParams?.reason === "string" ? item.bodyParams.reason : "";
            const inner = (
              <div
                className={cn(
                  "rounded-2xl border px-3 py-2",
                  item.read
                    ? "border-border bg-card"
                    : "border-[var(--dalily-gold)]/35 bg-[color-mix(in_oklab,var(--dalily-gold)_6%,var(--card))]",
                )}
              >
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(`categories.${item.category}`)}
                </p>
                <p className="text-sm font-medium">{titleOf(item)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{bodyOf(item)}</p>
                {reason ? (
                  <p className="mt-1 line-clamp-2 text-xs text-foreground/80">{reason}</p>
                ) : null}
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
                    onClick={() => {
                      if (!item.read) void markNotificationReadAction(item.id);
                    }}
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
