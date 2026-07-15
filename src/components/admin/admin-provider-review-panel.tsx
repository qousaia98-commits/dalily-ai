"use client";

import { useTransition } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  updateProviderStatusAction,
  type AdminActionState,
} from "@/actions/admin.actions";
import type { AdminProviderReview } from "@/lib/admin/queries";
import { getLocalizedField } from "@/types/provider.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/lib/i18n/routing";

type AdminProviderReviewPanelProps = {
  provider: AdminProviderReview;
};

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "active") return "default";
  if (status === "suspended" || status === "archived") return "destructive";
  if (status === "pending_review") return "outline";
  return "secondary";
}

export function AdminProviderReviewPanel({ provider }: AdminProviderReviewPanelProps) {
  const t = useTranslations("admin.providers");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<AdminActionState>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {getLocalizedField(provider.name, locale)}
            </h1>
            <Badge variant={statusVariant(provider.status)}>
              {t(`status.${provider.status}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {getLocalizedField(provider.cityName, locale)} ·{" "}
            {getLocalizedField(provider.categoryName, locale)} · {provider.slug}
          </p>
          <p className="text-sm text-muted-foreground">
            {provider.ownerDisplayName ?? provider.ownerEmail}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/providers">{t("review.back")}</Link>
          </Button>
          <Button
            disabled={pending || provider.status === "active"}
            className="gap-2"
            onClick={() => run(() => updateProviderStatusAction(provider.id, "active"))}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {t("actions.approve")}
          </Button>
          <Button
            variant="destructive"
            disabled={pending || provider.status === "draft"}
            className="gap-2"
            onClick={() => run(() => updateProviderStatusAction(provider.id, "draft"))}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            {t("actions.reject")}
          </Button>
        </div>
      </div>

      <div className="relative aspect-[21/9] overflow-hidden rounded-xl bg-muted">
        {provider.coverUrl ? (
          <Image src={provider.coverUrl} alt="" fill className="object-cover" sizes="100vw" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t("review.noCover")}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[12rem_1fr]">
        <div className="relative mx-auto size-40 overflow-hidden rounded-full bg-muted ring-2 ring-border">
          {provider.avatarUrl ? (
            <Image
              src={provider.avatarUrl}
              alt={getLocalizedField(provider.name, locale)}
              fill
              className="object-cover"
              sizes="160px"
            />
          ) : null}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("review.about")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="whitespace-pre-wrap text-muted-foreground">
              {provider.about
                ? getLocalizedField(provider.about, locale) || t("review.noAbout")
                : t("review.noAbout")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">{t("review.phone")}: </span>
                {provider.phone ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">{t("review.email")}: </span>
                {provider.email ?? "—"}
              </p>
              <p>
                <span className="text-muted-foreground">{t("review.verification")}: </span>
                {provider.verificationStatus}
              </p>
              <p>
                <span className="text-muted-foreground">{t("review.completeness")}: </span>
                {provider.profileCompleteness}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("review.services")}</CardTitle>
        </CardHeader>
        <CardContent>
          {provider.services.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("review.noServices")}</p>
          ) : (
            <ul className="space-y-2">
              {provider.services.map((service) => (
                <li key={service.id} className="rounded-lg border px-3 py-2 text-sm">
                  {getLocalizedField(service.name, locale)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("review.gallery")}</CardTitle>
        </CardHeader>
        <CardContent>
          {provider.gallery.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("review.noGallery")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {provider.gallery.map((image) => (
                <div key={image.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                  <Image src={image.url} alt="" fill className="object-cover" sizes="300px" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
