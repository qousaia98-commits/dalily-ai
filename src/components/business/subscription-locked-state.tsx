import { Clock3, ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import type { ProviderStatus } from "@/types/database.types";

type SubscriptionLockedStateProps = {
  status: ProviderStatus;
};

export async function SubscriptionLockedState({ status }: SubscriptionLockedStateProps) {
  const t = await getTranslations("business.subscription.locked");

  const isPending = status === "pending_review";

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-3xl border border-border/70 bg-card px-6 py-12 text-center shadow-sm">
      <span className="flex size-14 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_14%,transparent)] text-[var(--dalily-gold)]">
        {isPending ? <Clock3 className="size-6" aria-hidden /> : <ShieldCheck className="size-6" aria-hidden />}
      </span>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight text-[var(--dalily-navy)]">
          {isPending ? t("pendingTitle") : t("draftTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isPending ? t("pendingBody") : t("draftBody")}
        </p>
      </div>
      {!isPending ? (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/business/profile">{t("completeProfile")}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/business/verification">{t("uploadId")}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
