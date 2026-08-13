"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createQualityCaseAction,
  type QualityActionState,
} from "@/actions/quality.actions";
import { QUALITY_CASE_CATEGORIES } from "@/lib/quality/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initial: QualityActionState = { success: false };

type Props = {
  role: "customer" | "provider";
  providerId?: string;
  bookingId?: string;
};

export function QualityCaseCreateForm({ role, providerId, bookingId }: Props) {
  const t = useTranslations("quality.form");
  const te = useTranslations("quality.errors");
  const router = useRouter();
  const [state, action, pending] = useActionState(createQualityCaseAction, initial);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  if (state.success) {
    return (
      <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
        {t("success", { number: state.caseNumber ?? "" })}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-2xl border bg-card p-4">
      <input type="hidden" name="role" value={role} />
      {providerId ? <input type="hidden" name="providerId" value={providerId} /> : null}
      {bookingId ? <input type="hidden" name="bookingId" value={bookingId} /> : null}
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {t("title")}
      </h2>
      <div className="space-y-1.5">
        <Label htmlFor="category">{t("category")}</Label>
        <select
          id="category"
          name="category"
          className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          defaultValue="customer_complaint"
          required
        >
          {QUALITY_CASE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="priority">{t("priority")}</Label>
        <select
          id="priority"
          name="priority"
          className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          defaultValue="medium"
        >
          <option value="low">{t("priorities.low")}</option>
          <option value="medium">{t("priorities.medium")}</option>
          <option value="high">{t("priorities.high")}</option>
          <option value="urgent">{t("priorities.urgent")}</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title">{t("caseTitle")}</Label>
        <Input id="title" name="title" required minLength={3} maxLength={200} className="rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          required
          minLength={10}
          rows={4}
          className="rounded-xl"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="evidence">{t("evidence")}</Label>
        <Input
          id="evidence"
          name="evidence"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="rounded-xl"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {te(state.error as "failed")}
        </p>
      ) : null}
      <Button type="submit" className="w-full rounded-2xl" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
