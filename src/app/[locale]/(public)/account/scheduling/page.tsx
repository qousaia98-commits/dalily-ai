import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { isAiSchedulingEnabled } from "@/lib/config/feature-flags";
import { getCustomerScheduleHint } from "@/lib/scheduling-engine/service";
import { CustomerScheduleHintCard } from "@/components/scheduling/customer-schedule-hint-card";

export default async function AccountSchedulingPage() {
  if (!isAiSchedulingEnabled()) redirect("/account");
  await requireAuthUser();
  const t = await getTranslations("scheduling.customer");
  const hint = await getCustomerScheduleHint({});

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8 animate-fade-in">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      {hint ? <CustomerScheduleHintCard hint={hint} /> : null}
    </div>
  );
}
