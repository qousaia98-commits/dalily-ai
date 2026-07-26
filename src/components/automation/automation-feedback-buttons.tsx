"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { respondToAutomationAction } from "@/actions/automation.actions";
import { Button } from "@/components/ui/button";

export function AutomationFeedbackButtons({ actionId }: { actionId: string }) {
  const t = useTranslations("automation.feedback");
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7 rounded-lg text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await respondToAutomationAction({
              actionId,
              decision: "accepted",
            });
          })
        }
      >
        {t("accept")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 rounded-lg text-xs"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await respondToAutomationAction({
              actionId,
              decision: "rejected",
            });
          })
        }
      >
        {t("reject")}
      </Button>
    </div>
  );
}
