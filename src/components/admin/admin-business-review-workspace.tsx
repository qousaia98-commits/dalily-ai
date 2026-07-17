"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, Link } from "@/lib/i18n/routing";
import {
  Check,
  CheckCircle2,
  FileWarning,
  Loader2,
  X,
  XCircle,
  Maximize2,
} from "lucide-react";
import {
  approveBusinessAction,
  rejectBusinessAction,
  requestBusinessChangesAction,
} from "@/actions/admin-review.actions";
import type { AdminProviderReview } from "@/lib/admin/queries";
import { getLocalizedField } from "@/types/provider.types";
import { PlanBadge } from "@/components/shared/plan-badge";
import { AdminProviderSubscriptionCard } from "@/components/admin/admin-provider-subscription-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanSlug } from "@/lib/subscription/types";

type Props = { provider: AdminProviderReview };

type DialogMode = "changes" | "reject" | null;

const CHECKLIST_KEYS = [
  "companyInfo",
  "logo",
  "cover",
  "gallery",
  "openingHours",
  "location",
  "phone",
  "description",
  "idDocument",
] as const;

export function AdminBusinessReviewWorkspace({ provider }: Props) {
  const t = useTranslations("admin.review");
  const tStatus = useTranslations("admin.providers.status");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; alt: string } | null>(null);
  const [mobileSection, setMobileSection] = useState<"info" | "assets" | "verify">("info");

  const planLabel =
    provider.currentPlanSlug === "free"
      ? "Starter"
      : provider.currentPlanSlug === "premium"
        ? "PREMIUM"
        : "PRO";

  const checklistItems = useMemo(
    () =>
      CHECKLIST_KEYS.map((key) => ({
        key,
        ok: provider.checklist[key],
        label: t(`checklist.${key}`),
      })),
    [provider.checklist, t],
  );

  function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        setError(t(`errors.${result.error ?? "unknown"}`));
        return;
      }
      setDialog(null);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--dalily-navy)]">
              {getLocalizedField(provider.name, locale)}
            </h1>
            <Badge variant="outline">{tStatus(provider.status)}</Badge>
            <PlanBadge planSlug={provider.currentPlanSlug as PlanSlug} label={planLabel} />
          </div>
          <p className="text-sm text-muted-foreground">
            {provider.ownerDisplayName ?? provider.ownerEmail} · {provider.slug}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/providers">{t("back")}</Link>
        </Button>
      </div>

      {/* Mobile accordion tabs */}
      <div className="flex gap-2 lg:hidden" role="tablist" aria-label={t("sectionsLabel")}>
        {(["info", "assets", "verify"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mobileSection === key}
            onClick={() => setMobileSection(key)}
            className={cn(
              "min-h-11 flex-1 rounded-2xl border px-3 text-sm font-semibold transition-colors",
              mobileSection === key
                ? "border-[var(--dalily-gold)] bg-[var(--dalily-gold)]/10 text-[var(--dalily-navy)]"
                : "border-border text-muted-foreground",
            )}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.3fr)_minmax(16rem,0.95fr)]">
        {/* LEFT — info */}
        <section
          className={cn(
            "space-y-4 rounded-3xl border border-[#E8ECF2] bg-white p-5 shadow-sm",
            "lg:block",
            mobileSection !== "info" && "hidden lg:block",
          )}
        >
          <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            {t("infoTitle")}
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              { label: t("fields.name"), value: getLocalizedField(provider.name, locale) },
              { label: t("fields.owner"), value: provider.ownerDisplayName ?? provider.ownerEmail },
              { label: t("fields.category"), value: getLocalizedField(provider.categoryName, locale) },
              { label: t("fields.city"), value: getLocalizedField(provider.cityName, locale) },
              { label: t("fields.phone"), value: provider.phone ?? "—" },
              { label: t("fields.email"), value: provider.email ?? provider.ownerEmail },
              {
                label: t("fields.registered"),
                value: new Date(provider.createdAt).toLocaleDateString(locale),
              },
              { label: t("fields.status"), value: tStatus(provider.status) },
              { label: t("fields.plan"), value: planLabel },
            ].map((row) => (
              <div key={row.label}>
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="mt-0.5 font-medium text-[var(--dalily-navy)]">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="border-t border-border/70 pt-4">
            <h3 className="mb-3 text-sm font-bold text-[var(--dalily-navy)]">{t("checklistTitle")}</h3>
            <ul className="space-y-2">
              {checklistItems.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full",
                      item.ok ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600",
                    )}
                  >
                    {item.ok ? <Check className="size-3 stroke-[3]" /> : <X className="size-3 stroke-[3]" />}
                  </span>
                  <span className={item.ok ? "text-[var(--dalily-navy)]" : "font-medium text-rose-700"}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CENTER — assets */}
        <section
          className={cn(
            "space-y-4 rounded-3xl border border-[#E8ECF2] bg-white p-5 shadow-sm",
            mobileSection !== "assets" && "hidden lg:block",
          )}
        >
          <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            {t("assetsTitle")}
          </h2>

          <div className="relative aspect-[21/9] overflow-hidden rounded-2xl bg-muted">
            {provider.coverUrl ? (
              <button
                type="button"
                className="absolute inset-0"
                onClick={() => setPreview({ src: provider.coverUrl!, alt: t("cover") })}
                aria-label={t("zoomCover")}
              >
                <Image src={provider.coverUrl} alt="" fill className="object-cover" sizes="800px" />
                <span className="absolute end-3 top-3 rounded-full bg-black/50 p-2 text-white">
                  <Maximize2 className="size-4" />
                </span>
              </button>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("noCover")}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="relative size-20 overflow-hidden rounded-full bg-muted ring-2 ring-border">
              {provider.avatarUrl ? (
                <button
                  type="button"
                  className="absolute inset-0"
                  onClick={() => setPreview({ src: provider.avatarUrl!, alt: t("logo") })}
                  aria-label={t("zoomLogo")}
                >
                  <Image src={provider.avatarUrl} alt="" fill className="object-cover" sizes="80px" />
                </button>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">{t("logoHint")}</p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-[var(--dalily-navy)]">{t("gallery")}</h3>
            {provider.gallery.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noGallery")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {provider.gallery.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted"
                    onClick={() => setPreview({ src: image.url, alt: t("gallery") })}
                    aria-label={t("zoomGallery")}
                  >
                    <Image src={image.url} alt="" fill className="object-cover" sizes="200px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {provider.about ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-[var(--dalily-navy)]">{t("about")}</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {getLocalizedField(provider.about, locale)}
              </p>
            </div>
          ) : null}
        </section>

        {/* RIGHT — verification + decisions */}
        <section
          className={cn(
            "space-y-4 rounded-3xl border border-[#E8ECF2] bg-white p-5 shadow-sm",
            mobileSection !== "verify" && "hidden lg:block",
          )}
        >
          <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">
            {t("verificationTitle")}
          </h2>

          <div className="space-y-3">
            {[
              { label: t("idFront"), url: provider.idDocuments.idFrontUrl },
              { label: t("idBack"), url: provider.idDocuments.idBackUrl },
              { label: t("selfie"), url: provider.idDocuments.selfieUrl },
            ].map((doc) => (
              <div key={doc.label} className="rounded-2xl border border-border/70 p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">{doc.label}</p>
                {doc.url ? (
                  <button
                    type="button"
                    className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted"
                    onClick={() => setPreview({ src: doc.url!, alt: doc.label })}
                    aria-label={t("zoomId")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={doc.url} alt="" className="size-full object-cover" />
                  </button>
                ) : (
                  <p className="text-sm text-rose-600">{t("missingDoc")}</p>
                )}
              </div>
            ))}
          </div>

          <AdminProviderSubscriptionCard
            currentPlanSlug={provider.currentPlanSlug}
            openPayment={provider.openPayment}
          />

          <div className="space-y-2 border-t border-border/70 pt-4">
            <p className="text-sm font-bold text-[var(--dalily-navy)]">{t("decisionTitle")}</p>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              className="h-12 w-full gap-2 rounded-2xl"
              disabled={pending || provider.status === "active"}
              onClick={() => run(() => approveBusinessAction(provider.id))}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {t("approve")}
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full gap-2 rounded-2xl border-amber-300 text-amber-800 hover:bg-amber-50"
              disabled={pending}
              onClick={() => setDialog("changes")}
            >
              <FileWarning className="size-4" />
              {t("requestChanges")}
            </Button>
            <Button
              variant="destructive"
              className="h-12 w-full gap-2 rounded-2xl"
              disabled={pending || provider.status === "draft"}
              onClick={() => setDialog("reject")}
            >
              <XCircle className="size-4" />
              {t("reject")}
            </Button>
          </div>
        </section>
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-dialog-title"
            className="w-full max-w-md rounded-3xl bg-background p-6 shadow-xl"
          >
            <h3 id="review-dialog-title" className="text-lg font-bold text-[var(--dalily-navy)]">
              {dialog === "changes" ? t("changesDialogTitle") : t("rejectDialogTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {dialog === "changes" ? t("changesDialogBody") : t("rejectDialogBody")}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="mt-4 w-full rounded-2xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--dalily-gold)]"
              placeholder={dialog === "changes" ? t("changesPlaceholder") : t("rejectPlaceholder")}
            />
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => {
                  setDialog(null);
                  setNote("");
                }}
              >
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                variant={dialog === "reject" ? "destructive" : "default"}
                disabled={pending || note.trim().length < 3}
                onClick={() =>
                  run(() =>
                    dialog === "changes"
                      ? requestBusinessChangesAction(provider.id, note)
                      : rejectBusinessAction(provider.id, note),
                  )
                }
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : t("confirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t("closePreview")}
            onClick={() => setPreview(null)}
          />
          <div className="relative z-10 max-h-[90vh] max-w-4xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.src}
              alt={preview.alt}
              className="max-h-[90vh] w-auto rounded-2xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
