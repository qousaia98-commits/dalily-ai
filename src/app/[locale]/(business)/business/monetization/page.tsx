import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/database";
import { isProviderMonetizationEnabled } from "@/lib/config/feature-flags";
import { getMonetizationDashboard } from "@/lib/monetization";
import { getActiveBusinessSubscriptionPayment } from "@/lib/payment/business-subscription";
import { MonetizationDashboardPanel } from "@/components/business/monetization-dashboard-panel";

export default async function BusinessMonetizationPage() {
  if (!isProviderMonetizationEnabled()) redirect("/business/payments");

  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);
  if (!provider) redirect("/business");

  const [dashboard, pendingPayment] = await Promise.all([
    getMonetizationDashboard(provider.id),
    getActiveBusinessSubscriptionPayment(provider.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6 animate-fade-in">
      <MonetizationDashboardPanel
        dashboard={dashboard}
        pendingPayment={pendingPayment}
      />
    </main>
  );
}
