import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { listAdminActivityFeed } from "@/lib/admin/control-center";
import { listAdminActionLogs } from "@/lib/admin/action-log";
import { formatDateTime } from "@/lib/format/datetime";

export default async function AdminAuditPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.audit");
  const [legacy, actions] = await Promise.all([
    listAdminActivityFeed(40),
    listAdminActionLogs(40),
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("moderationLog")}</h2>
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {actions.map((row) => (
              <li key={row.id} className="rounded-xl border px-3 py-2 text-sm">
                <p className="font-medium">
                  {row.action} · {row.entityType}
                  {row.entityId ? ` · ${row.entityId.slice(0, 8)}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(row.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("auditLog")}</h2>
        {legacy.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {legacy.map((row) => (
              <li key={row.id} className="rounded-xl border px-3 py-2 text-sm">
                <p className="font-medium">
                  {row.action} · {row.entityType}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.actorName ?? "—"} · {formatDateTime(row.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
