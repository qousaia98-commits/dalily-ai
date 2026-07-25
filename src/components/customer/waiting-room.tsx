import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Loader2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServiceRequestDetail } from "@/lib/service-requests/types";

export async function WaitingRoom({
  request,
  state,
}: {
  request: ServiceRequestDetail | null;
  state: "loading" | "ready" | "empty" | "error";
}) {
  const t = await getTranslations("intentFlow.waiting");

  if (state === "loading") {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (state === "error" || !request) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <h1 className="text-xl font-semibold">{t("errorTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("errorBody")}</p>
        <Button asChild>
          <Link href="/request/new">{t("startNew")}</Link>
        </Button>
      </div>
    );
  }

  // Sprint 2: offers/matching not live yet — empty is the honest default state.
  return (
    <div className="mx-auto max-w-lg space-y-6 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        {t("trustNotBroadcast")}
      </div>

      <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
        <Inbox className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden />
        <p className="font-medium">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
      </div>

      <div className="rounded-xl border border-border/60 px-4 py-3 text-sm">
        <p className="font-medium text-foreground">{t("requestLabel")}</p>
        <p className="mt-1 text-muted-foreground">{request.intent_text || request.description}</p>
        {request.urgency === "emergency" && (
          <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
            {t("emergencyBadge")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild variant="outline" className="flex-1">
          <Link href="/account/requests">{t("myRequests")}</Link>
        </Button>
        <Button asChild className="flex-1">
          <Link href="/request/new">{t("startNew")}</Link>
        </Button>
      </div>
    </div>
  );
}
