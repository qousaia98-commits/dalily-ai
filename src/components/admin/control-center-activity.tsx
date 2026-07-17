import { getTranslations } from "next-intl/server";
import type { AdminActivityItem } from "@/lib/admin/control-center";
import { cn } from "@/lib/utils";

const KNOWN_ACTIONS = new Set([
  "provider_approved",
  "provider_rejected",
  "provider_changes_requested",
  "payment_approved",
  "payment_rejected",
  "provider_suspended",
  "provider_archived",
]);

export async function ControlCenterActivityFeed({ items }: { items: AdminActivityItem[] }) {
  const t = await getTranslations("admin.controlCenter.activity");

  return (
    <aside
      className="rounded-3xl border border-[#E8ECF2] bg-white p-5 shadow-[0_12px_32px_-22px_rgba(11,21,38,0.2)]"
      aria-labelledby="activity-feed-title"
    >
      <h2 id="activity-feed-title" className="text-base font-bold text-[var(--dalily-navy)]">
        {t("title")}
      </h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn("rounded-2xl border border-border/60 bg-muted/20 px-3 py-3")}
            >
              <p className="text-sm font-semibold text-[var(--dalily-navy)]">
                {KNOWN_ACTIONS.has(item.action)
                  ? t(`actions.${item.action}`)
                  : item.action.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.actorName ? t("by", { name: item.actorName }) : t("system")}
                {" · "}
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
