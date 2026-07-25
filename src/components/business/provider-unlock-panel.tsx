"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  confirmUnlockDevBypassAction,
  declineUnlockAction,
} from "@/actions/unlock.actions";
import type { UnlockSessionView } from "@/domains/unlock/types";

export function ProviderUnlockPanel({
  session,
  requestTitle,
  allowDevBypass,
}: {
  session: UnlockSessionView;
  requestTitle: string;
  allowDevBypass: boolean;
}) {
  const t = useTranslations("unlockFlow");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.success) {
        setError(result.error ?? "failed");
        return;
      }
      router.refresh();
    });
  };

  const open = session.status === "opened" || session.status === "payment_pending";

  return (
    <div className="space-y-4 rounded-2xl border border-border p-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("provider.title")}</h1>
        <p className="text-sm text-muted-foreground">{requestTitle}</p>
        <p className="text-sm">
          {t("provider.fee", {
            amount: session.feeAmount,
            currency: session.feeCurrency,
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("provider.sla", { deadline: new Date(session.slaDeadline).toLocaleString() })}
        </p>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t(`status.${session.status}`)}
        </p>
      </div>

      <p className="text-sm text-muted-foreground">{t("provider.noContactUntilPay")}</p>

      {open ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          {allowDevBypass ? (
            <Button
              className="rounded-xl"
              disabled={pending}
              onClick={() => run(() => confirmUnlockDevBypassAction(session.id))}
            >
              {t("provider.devConfirm")}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("provider.awaitAdminOrSprint6")}</p>
          )}
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={pending}
            onClick={() => run(() => declineUnlockAction(session.id))}
          >
            {t("provider.decline")}
          </Button>
        </div>
      ) : null}

      {session.status === "succeeded" ? (
        <p className="text-sm font-medium">{t("provider.succeeded")}</p>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${error}` as "errors.failed")}
        </p>
      ) : null}
    </div>
  );
}
