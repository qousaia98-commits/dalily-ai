import { getTranslations } from "next-intl/server";
import { requireAuthUser } from "@/lib/auth/session";
import { getOwnedProvider } from "@/lib/providers/queries";
import { ProviderCreateFormLoader } from "@/components/business/provider-create-form-loader";
import { ProviderStatusBadge } from "@/components/business/provider-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/i18n/routing";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default async function BusinessDashboardPage() {
  const t = await getTranslations("business.dashboard");
  const tVerification = await getTranslations("business.dashboard.verificationStatus");
  const authUser = await requireAuthUser();
  const provider = await getOwnedProvider(authUser.id);

  if (!provider) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("noProviderSubtitle")}</p>
        </div>
        <ProviderCreateFormLoader />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ProviderStatusBadge status={provider.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("profileStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("completion")}</span>
              <span className="font-semibold">{provider.profileCompleteness}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${provider.profileCompleteness}%` }}
                role="progressbar"
                aria-valuenow={provider.profileCompleteness}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t("completion")}
              />
            </div>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/business/profile">
                {t("completeProfile")}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("overview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("servicesCount")}</span>
              <span className="font-medium">{provider.services.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("galleryCount")}</span>
              <span className="font-medium">{provider.gallery.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("verification")}</span>
              <span className="font-medium">
                {tVerification(provider.verificationStatus)}
              </span>
            </div>
            {provider.status === "draft" ? (
              <p className="text-muted-foreground">{t("draftNote")}</p>
            ) : null}
            {provider.status === "pending_review" ? (
              <p className="text-muted-foreground">{t("pendingNote")}</p>
            ) : null}
            {provider.status === "active" ? (
              <p className="text-emerald-600 dark:text-emerald-400">{t("activeNote")}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
