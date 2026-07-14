"use client";

import { useActionState, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import {
  approveVerificationAction,
  getVerificationDocumentUrlAction,
  rejectVerificationAction,
  type VerificationActionState,
} from "@/actions/verification.actions";
import type { AdminVerificationItem } from "@/lib/verification/queries";
import { getLocalizedField } from "@/types/provider.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const initialState: VerificationActionState = { success: false };

type AdminVerificationListProps = {
  items: AdminVerificationItem[];
};

function DocumentLink({ label, path }: { label: string; path: string | null }) {
  const [pending, startTransition] = useTransition();

  if (!path) {
    return <span className="text-sm text-muted-foreground">{label}: —</span>;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await getVerificationDocumentUrlAction(path);
          if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
        });
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
      {label}
    </Button>
  );
}

function RejectForm({ providerId }: { providerId: string }) {
  const t = useTranslations("admin.verification");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(rejectVerificationAction, initialState);

  if (!open) {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <XCircle className="size-4" />
        {t("reject")}
      </Button>
    );
  }

  return (
    <form
      action={action}
      className="flex w-full flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={() => setTimeout(() => router.refresh(), 300)}
    >
      <input type="hidden" name="providerId" value={providerId} />
      <div className="flex-1 space-y-1">
        <Label htmlFor={`reject-${providerId}`}>{t("rejectionReason")}</Label>
        <Input
          id={`reject-${providerId}`}
          name="rejectionReason"
          required
          minLength={3}
          maxLength={500}
          placeholder={t("rejectionPlaceholder")}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending} className="gap-2">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("confirmReject")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive">{t(`errors.${state.error}`)}</p> : null}
    </form>
  );
}

function ApproveButton({ providerId }: { providerId: string }) {
  const t = useTranslations("admin.verification");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      className="gap-2"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          await approveVerificationAction(providerId);
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
      {t("approve")}
    </Button>
  );
}

export function AdminVerificationList({ items }: AdminVerificationListProps) {
  const t = useTranslations("admin.verification");
  const locale = useLocale();

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">{t("empty")}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-lg">
                {getLocalizedField(item.providerName, locale)}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.ownerDisplayName ?? item.ownerEmail}
              </p>
            </div>
            <Badge variant="secondary">{t("status.pending")}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <DocumentLink label={t("documents.idFront")} path={item.idFrontUrl} />
              <DocumentLink label={t("documents.idBack")} path={item.idBackUrl} />
              <DocumentLink label={t("documents.selfie")} path={item.selfieUrl} />
            </div>
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <ApproveButton providerId={item.providerId} />
              <RejectForm providerId={item.providerId} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
