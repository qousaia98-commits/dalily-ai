"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import type { ServiceRequestActionState } from "@/actions/service-request.actions";

type Props = {
  requestId: string;
  acceptAction: (id: string) => Promise<ServiceRequestActionState>;
  rejectAction: (id: string) => Promise<ServiceRequestActionState>;
};

export function PendingRequestActions({ requestId, acceptAction, rejectAction }: Props) {
  const t = useTranslations("business.requests");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="sticky top-16 z-20 space-y-2 rounded-2xl border border-border bg-card/95 p-3 shadow-md backdrop-blur">
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11 gap-2 rounded-2xl"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await acceptAction(requestId);
              if (!result.success) {
                setError(result.error ?? "accept_failed");
                return;
              }
              if (result.conversationId) {
                router.push(`/business/messages/${result.conversationId}`);
              }
              router.refresh();
            })
          }
        >
          <Check className="size-4" />
          {t("accept")}
        </Button>
        <Button
          variant="outline"
          className="min-h-11 gap-2 rounded-2xl"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await rejectAction(requestId);
              if (!result.success) {
                setError(result.error ?? "reject_failed");
                return;
              }
              router.refresh();
            })
          }
        >
          <X className="size-4" />
          {t("reject")}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`errors.${error}` as "errors.accept_failed")}
        </p>
      ) : null}
    </div>
  );
}
