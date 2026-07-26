import { getTranslations } from "next-intl/server";
import { requireAdminUser } from "@/lib/auth/session";
import { listStripeWebhookEventsAction } from "@/actions/stripe.actions";
import { AdminStripeWebhooksPanel } from "@/components/admin/admin-stripe-webhooks-panel";
import { Link } from "@/lib/i18n/routing";

export default async function AdminStripeWebhooksPage() {
  await requireAdminUser();
  const t = await getTranslations("admin.stripeWebhooks");
  const listed = await listStripeWebhookEventsAction(100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--dalily-gold)]">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("pageSubtitle")}</p>
        <Link
          href="/admin/payments"
          className="mt-2 inline-block text-sm text-[var(--dalily-gold)] hover:underline"
        >
          {t("backToPayments")}
        </Link>
      </div>
      <AdminStripeWebhooksPanel events={listed.ok ? listed.events : []} />
    </div>
  );
}
