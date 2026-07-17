import { getTranslations } from "next-intl/server";
import {
  Building2,
  CreditCard,
  FileWarning,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Link } from "@/lib/i18n/routing";
import type { ControlCenterOverview } from "@/lib/admin/control-center";
import { cn } from "@/lib/utils";

type TaskCardProps = {
  href: string;
  title: string;
  body: string;
  count: number;
  tone: "danger" | "gold" | "amber" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  openLabel: string;
};

function TaskCard({ href, title, body, count, tone, icon: Icon, openLabel }: TaskCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-[7.5rem] flex-col justify-between rounded-3xl border p-5 transition-all duration-200",
        "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        tone === "danger" &&
          "border-rose-200/80 bg-[linear-gradient(160deg,#fff_0%,#FFF5F5_100%)] shadow-[0_14px_36px_-22px_rgba(190,24,93,0.35)]",
        tone === "gold" &&
          "border-[var(--dalily-gold)]/40 bg-[linear-gradient(160deg,#fff_0%,#FBF8F0_100%)] shadow-[0_14px_36px_-20px_rgba(196,160,82,0.45)]",
        tone === "amber" &&
          "border-amber-200 bg-[linear-gradient(160deg,#fff_0%,#FFFBEB_100%)] shadow-[0_14px_36px_-22px_rgba(180,120,20,0.3)]",
        tone === "muted" &&
          "border-[#E8ECF2] bg-white shadow-[0_12px_32px_-22px_rgba(11,21,38,0.2)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-11 items-center justify-center rounded-2xl",
            tone === "danger" && "bg-rose-500/10 text-rose-600",
            tone === "gold" && "bg-[var(--dalily-gold)]/15 text-[var(--dalily-gold)]",
            tone === "amber" && "bg-amber-500/15 text-amber-700",
            tone === "muted" && "bg-[var(--dalily-navy)]/5 text-[var(--dalily-navy)]",
          )}
        >
          <Icon className="size-5" />
        </span>
        {count > 0 ? (
          <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-[var(--dalily-navy)] px-2 py-0.5 text-xs font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-base font-bold text-[var(--dalily-navy)]">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--dalily-gold)] opacity-80 transition-opacity group-hover:opacity-100">
        {openLabel}
        <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}

export async function ControlCenterTasks({ overview }: { overview: ControlCenterOverview }) {
  const t = await getTranslations("admin.controlCenter.tasks");

  return (
    <section className="space-y-4" aria-labelledby="today-tasks-title">
      <h2 id="today-tasks-title" className="text-xl font-bold tracking-tight text-[var(--dalily-navy)]">
        {t("title")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TaskCard
          href="/admin/providers?status=pending_review"
          title={t("businesses.title")}
          body={t("businesses.body")}
          count={overview.pendingBusinesses}
          tone="danger"
          icon={Building2}
          openLabel={t("open")}
        />
        <TaskCard
          href="/admin/payments?tab=pending_review"
          title={t("payments.title")}
          body={t("payments.body")}
          count={overview.pendingPayments}
          tone="gold"
          icon={CreditCard}
          openLabel={t("open")}
        />
        <TaskCard
          href="/admin/providers?status=changes_requested"
          title={t("changes.title")}
          body={t("changes.body")}
          count={overview.changesRequested}
          tone="amber"
          icon={FileWarning}
          openLabel={t("open")}
        />
        <TaskCard
          href="/admin/messages"
          title={t("messages.title")}
          body={t("messages.body")}
          count={overview.unreadMessages}
          tone="muted"
          icon={MessageSquare}
          openLabel={t("open")}
        />
      </div>
    </section>
  );
}
