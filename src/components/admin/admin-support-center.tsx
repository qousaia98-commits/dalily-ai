"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { resolveSupportMessageAction } from "@/actions/support.actions";
import type { AdminSupportMessageItem } from "@/lib/admin/support-center";
import { formatDateTime } from "@/lib/format/datetime";
import { Button } from "@/components/ui/button";

type Props = { items: AdminSupportMessageItem[] };

export function AdminSupportCenter({ items }: Props) {
  const t = useTranslations("admin.support");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  function setStatus(id: string, status: AdminSupportMessageItem["status"]) {
    startTransition(async () => {
      await resolveSupportMessageAction({ messageId: id, status });
      router.refresh();
    });
  }

  return (
    <ul className="space-y-3" aria-busy={pending}>
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`status.${item.status}`)} · {t(`role.${item.role}` as "role.customer")}
              </p>
              <p className="font-semibold">{item.subject}</p>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.message}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus(item.id, "in_progress")}>
                {t("actions.inProgress")}
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => setStatus(item.id, "resolved")}>
                {t("actions.resolve")}
              </Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => setStatus(item.id, "closed")}>
                {t("actions.close")}
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
