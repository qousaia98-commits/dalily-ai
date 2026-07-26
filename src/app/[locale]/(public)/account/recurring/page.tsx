import { redirect } from "next/navigation";
import { requireAuthUser } from "@/lib/auth/session";
import { isRecurringServicesEnabled } from "@/lib/config/feature-flags";
import { getRecurringDashboard } from "@/lib/recurring";
import { RecurringDashboardPanel } from "@/components/customer/recurring-dashboard";

export default async function AccountRecurringPage() {
  if (!isRecurringServicesEnabled()) {
    redirect("/account/bookings");
  }

  const user = await requireAuthUser();
  const dashboard = await getRecurringDashboard(user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
      <RecurringDashboardPanel dashboard={dashboard} />
    </main>
  );
}
