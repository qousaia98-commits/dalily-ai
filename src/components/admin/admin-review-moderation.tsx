"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { moderateReviewAction, warnUserAction } from "@/actions/admin-control-center.actions";
import type { AdminModerationReview } from "@/lib/admin/review-moderation";
import { formatDateTime } from "@/lib/format/datetime";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/routing";

type Props = { items: AdminModerationReview[]; spamReady: boolean };

export function AdminReviewModerationPanel({ items, spamReady }: Props) {
  const t = useTranslations("admin.reviewModeration");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {spamReady ? t("spamReady") : t("spamNotReady")}
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold">
                    ★ {item.rating} · {item.status}
                    {item.isVerified ? ` · ${t("verified")}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.comment || t("noComment")}</p>
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/admin/providers/${item.providerId}`} className="underline">
                      {t("provider")}
                    </Link>
                    {" · "}
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => moderateReviewAction({ reviewId: item.id, action: "hide" }))}
                  >
                    {t("actions.hide")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => run(() => moderateReviewAction({ reviewId: item.id, action: "restore" }))}
                  >
                    {t("actions.restore")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(t("actions.deleteConfirm"))) {
                        run(() => moderateReviewAction({ reviewId: item.id, action: "delete" }));
                      }
                    }}
                  >
                    {t("actions.delete")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        warnUserAction({
                          userId: item.customerId,
                          role: "customer",
                          message: t("warnDefault"),
                        }),
                      )
                    }
                  >
                    {t("actions.warnCustomer")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
