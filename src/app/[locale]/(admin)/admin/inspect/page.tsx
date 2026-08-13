import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/session";
import { canAccessAdminPanel } from "@/lib/auth/roles";
import { isAdminMigrationV2Enabled } from "@/lib/config/feature-flags";
import { inspectMarketplaceRequest } from "@/domains/admin/inspection";
import { WhyMatchedReasons } from "@/components/business/why-matched-reasons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PageProps = {
  searchParams: Promise<{ requestId?: string }>;
};

export default async function AdminInspectPage({ searchParams }: PageProps) {
  if (!isAdminMigrationV2Enabled()) redirect("/admin/marketplace");

  const authUser = await requireAdminUser();
  if (!canAccessAdminPanel(authUser.roles)) redirect("/");

  const t = await getTranslations("admin.inspect");
  const params = await searchParams;
  const requestId = params.requestId?.trim() || "";
  const inspection =
    requestId.length > 0 ? await inspectMarketplaceRequest(requestId) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form className="flex flex-wrap gap-2 rounded-xl border bg-card p-4">
        <Input
          name="requestId"
          defaultValue={requestId}
          placeholder={t("requestIdPlaceholder")}
          className="max-w-md"
        />
        <Button type="submit">{t("load")}</Button>
      </form>

      {requestId && !inspection ? (
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
      ) : null}

      {inspection ? (
        <div className="space-y-4 text-sm">
          <section className="rounded-2xl border border-border px-4 py-3">
            <h2 className="font-semibold">{inspection.title}</h2>
            <p className="text-muted-foreground">
              {inspection.status} · lifecycle {inspection.lifecycleVersion}
            </p>
            {inspection.cellKey ? (
              <p className="mt-1 font-mono text-xs">{inspection.cellKey}</p>
            ) : null}
            {inspection.cellPolicy ? (
              <p className="mt-1 text-amber-700 dark:text-amber-400">
                {inspection.cellPolicy.frozen ? t("cellFrozen") : null}
                {inspection.cellPolicy.limitedAvailability ? ` · ${t("cellLimited")}` : null}
                {inspection.cellPolicy.concierge ? ` · ${t("cellConcierge")}` : null}
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">{t("noCellPolicy")}</p>
            )}
          </section>

          <section className="rounded-2xl border border-border px-4 py-3">
            <h3 className="font-semibold">{t("pool")}</h3>
            {inspection.pool ? (
              <p className="text-muted-foreground">
                {inspection.pool.status} · assigned {inspection.pool.assignedCount} · expand{" "}
                {inspection.pool.expandCount}
              </p>
            ) : (
              <p className="text-muted-foreground">{t("noPool")}</p>
            )}
            <ul className="mt-2 space-y-2">
              {inspection.assignments.map((a) => (
                <li key={`${a.providerId}-${a.rankInPool}`} className="rounded-lg bg-muted/30 px-3 py-2">
                  <p>
                    #{a.rankInPool} · {a.providerId.slice(0, 8)}… · {a.source}
                  </p>
                  <WhyMatchedReasons reasons={a.reasons} />
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border px-4 py-3">
            <h3 className="font-semibold">{t("offers")}</h3>
            {inspection.offers.length === 0 ? (
              <p className="text-muted-foreground">{t("noOffers")}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {inspection.offers.map((o) => (
                  <li key={o.id}>
                    {o.status} · {o.price ?? "—"} {o.currency ?? ""} ·{" "}
                    {o.providerId.slice(0, 8)}…
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border px-4 py-3">
            <h3 className="font-semibold">{t("unlock")}</h3>
            {inspection.selection ? (
              <p>
                selection {inspection.selection.status} · offer{" "}
                {inspection.selection.offerId?.slice(0, 8) ?? "—"}…
              </p>
            ) : (
              <p className="text-muted-foreground">{t("noSelection")}</p>
            )}
            {inspection.unlockSession ? (
              <p className="mt-1">
                unlock {inspection.unlockSession.status} · SLA{" "}
                {new Date(inspection.unlockSession.slaDeadline).toLocaleString()}
              </p>
            ) : (
              <p className="mt-1 text-muted-foreground">{t("noUnlock")}</p>
            )}
            <p className="mt-1">{inspection.hasGrant ? t("grantYes") : t("grantNo")}</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
