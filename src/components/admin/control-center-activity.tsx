import { getTranslations } from "next-intl/server";
import type { AdminActivityItem } from "@/lib/admin/control-center";
import { formatDateTime } from "@/lib/format/datetime";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";

const KNOWN_ACTIONS = new Set([
  "provider_approved",
  "provider_rejected",
  "provider_changes_requested",
  "payment_approved",
  "payment_rejected",
  "provider_suspended",
  "provider_archived",
  "verification_approved",
  "verification_rejected",
  "verification_changes_requested",
]);

export async function ControlCenterActivityFeed({ items }: { items: AdminActivityItem[] }) {
  const t = await getTranslations("admin.controlCenter.activity");
  const latest = items.slice(0, 5);

  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
      aria-labelledby="activity-feed-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="activity-feed-title" className="text-base font-bold text-foreground">
          {t("title")}
        </h2>
        <Link
          href="/admin/audit"
          className="text-xs font-semibold text-[var(--dalily-gold)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
        >
          {t("viewAll")}
        </Link>
      </div>

      {latest.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {latest.map((item) => (
            <li
              key={item.id}
              className={cn("rounded-xl border border-border/70 bg-muted/20 px-3 py-3")}
            >
              <p className="text-sm font-semibold text-foreground">
                {KNOWN_ACTIONS.has(item.action)
                  ? t(`actions.${item.action}`)
                  : t("actions.generic")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.actorName ? t("by", { name: item.actorName }) : t("system")}
                {" · "}
                {formatDateTime(item.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
