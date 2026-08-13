"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryStripeWebhookEventAction } from "@/actions/stripe.actions";
import { formatDateTime } from "@/lib/format/datetime";

export type StripeWebhookRow = {
  id: string;
  externalEventId: string;
  eventType: string;
  status: string;
  paymentId: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
};

export function AdminStripeWebhooksPanel({
  events,
}: {
  events: StripeWebhookRow[];
}) {
  const t = useTranslations("admin.stripeWebhooks");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      {events.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="rounded-2xl border border-border bg-card p-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{ev.eventType}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(ev.createdAt, locale)} · {ev.status}
                    {ev.retryCount > 0 ? ` · retry ${ev.retryCount}` : ""}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {ev.externalEventId}
                  </p>
                  {ev.paymentId ? (
                    <p className="text-xs">payment: {ev.paymentId}</p>
                  ) : null}
                  {ev.errorMessage ? (
                    <p className="text-xs text-destructive">{ev.errorMessage}</p>
                  ) : null}
                </div>
                {ev.status === "failed" || ev.status === "received" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await retryStripeWebhookEventAction(ev.id);
                        if (!result.success) toast.error(t("retryError"));
                        else toast.success(t("retrySuccess"));
                      });
                    }}
                  >
                    {t("retry")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
