import { getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";
import { getAuthUser } from "@/lib/auth/session";
import { listCustomerRequests } from "@/lib/service-requests/queries";
import { Link } from "@/lib/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { RequestTimeline } from "@/components/marketplace/request-timeline";

export default async function CustomerRequestsPage() {
  const t = await getTranslations("marketplace.myRequests");
  const locale = await getLocale();
  const authUser = await getAuthUser();
  if (!authUser) {
    redirect({ href: "/login", locale });
    return null;
  }

  const requests = await listCustomerRequests(authUser.id);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6 animate-fade-in">
      <header className="space-y-2">
        <p className="text-xs font-bold tracking-[0.16em] text-[var(--dalily-gold)] uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {requests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
          <Link href="/search" className="mt-4 inline-block text-sm font-semibold text-[var(--dalily-gold)]">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {requests.map((request) => (
            <li key={request.id} className="rounded-3xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/account/requests/${request.id}`}
                    className="font-bold text-foreground hover:underline"
                  >
                    {request.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">{request.providerName}</p>
                </div>
                <Badge variant="secondary">{t(`status.${request.status}`)}</Badge>
              </div>
              <div className="mt-4 max-h-48 overflow-hidden">
                <RequestTimeline
                  status={request.status}
                  hasQuote={Boolean(request.quote)}
                  compact
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
