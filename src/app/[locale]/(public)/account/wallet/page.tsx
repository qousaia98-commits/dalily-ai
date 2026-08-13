import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { isPaymentWalletEnabled, isPaymentsV2Enabled } from "@/lib/config/feature-flags";
import { WalletDashboardPanel } from "@/components/payment/wallet-dashboard-panel";

export default async function AccountWalletPage() {
  await requireAuthUser();
  if (!isPaymentsV2Enabled() || !isPaymentWalletEnabled()) {
    redirect("/account");
  }

  const t = await getTranslations("wallet");

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8 animate-fade-in sm:px-0">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <WalletDashboardPanel mode="customer" />
    </div>
  );
}
