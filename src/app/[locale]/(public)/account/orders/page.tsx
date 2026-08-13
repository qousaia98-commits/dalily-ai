import { getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/navigation";
import { getLocale } from "next-intl/server";
import { getAuthUser } from "@/lib/auth/session";
import { isBusinessUser } from "@/lib/auth/roles";
import { listCustomerRequests } from "@/lib/service-requests/queries";
import { countCustomerOrderTabs } from "@/lib/orders/tabs";
import { OrdersBoard } from "@/components/orders/orders-board";
import { MarkNavChannelSeen } from "@/components/shared/mark-nav-channel-seen";

export default async function CustomerOrdersPage() {
  const t = await getTranslations("orders");
  const locale = await getLocale();
  const authUser = await getAuthUser();
  if (!authUser) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (isBusinessUser(authUser.roles)) {
    redirect({ href: "/business/orders", locale });
    return null;
  }

  const requests = await listCustomerRequests(authUser.id);
  const tabCounts = countCustomerOrderTabs(requests);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6 animate-fade-in">
      <MarkNavChannelSeen channel="orders" />
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("customerEyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("customerTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("customerSubtitle")}</p>
      </header>

      <OrdersBoard
        mode="customer"
        requests={requests}
        tabCounts={tabCounts}
        userId={authUser.id}
        detailBasePath="/account/requests"
      />
    </div>
  );
}
