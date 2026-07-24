"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/routing";
import {
  CalendarDays,
  Clock3,
  Inbox,
  CalendarClock,
  User,
  Images,
  Wrench,
  ShieldCheck,
} from "lucide-react";

const actions = [
  { key: "calendar", href: "/business/calendar", icon: CalendarDays },
  { key: "availability", href: "/business/availability", icon: Clock3 },
  { key: "inbox", href: "/business/messages", icon: Inbox },
  { key: "bookings", href: "/business/bookings", icon: CalendarClock },
  { key: "profile", href: "/business/profile", icon: User },
  { key: "portfolio", href: "/business/media", icon: Images },
  { key: "services", href: "/business/services", icon: Wrench },
  { key: "verify", href: "/business/verification", icon: ShieldCheck },
] as const;

export function SuccessQuickActions({
  showVerify,
  hideHeader = false,
}: {
  showVerify: boolean;
  hideHeader?: boolean;
}) {
  const t = useTranslations("business.success.quickActions");
  const list = showVerify ? actions : actions.filter((a) => a.key !== "verify");

  return (
    <section className="space-y-3" aria-labelledby={hideHeader ? undefined : "success-qa-title"}>
      {!hideHeader ? (
        <h2 id="success-qa-title" className="text-lg font-bold tracking-tight">
          {t("title")}
        </h2>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {list.map(({ key, href, icon: Icon }) => (
          <Link
            key={key}
            href={href}
            className="flex min-h-[4.5rem] flex-col justify-between rounded-2xl border border-border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--dalily-gold)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)] motion-reduce:hover:translate-y-0"
          >
            <Icon className="size-4 text-[var(--dalily-gold)]" aria-hidden />
            <span className="text-sm font-semibold">{t(key)}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
