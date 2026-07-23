"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateIssueModerationAction } from "@/actions/admin-control-center.actions";
import type { AdminIssueItem } from "@/lib/admin/issue-center";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/routing";

type Props = { items: AdminIssueItem[] };

export function AdminIssueCenter({ items }: Props) {
  const t = useTranslations("admin.issues");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  function setStatus(id: string, status: AdminIssueItem["moderationStatus"]) {
    startTransition(async () => {
      await updateIssueModerationAction({
        issueId: id,
        status,
        assignToSelf: status === "in_progress",
      });
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
                {t(`status.${item.moderationStatus}`)}
              </p>
                  <p className="font-semibold">{item.reason}</p>
              {item.details ? <p className="text-sm text-muted-foreground">{item.details}</p> : null}
              <p className="text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()} ·{" "}
                <Link href={`/admin/providers/${item.providerId}`} className="underline">
                  {t("viewProvider")}
                </Link>
              </p>
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
