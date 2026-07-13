"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/routing";
import {
  addServiceAction,
  updateServiceAction,
  deleteServiceAction,
  type ProviderActionState,
} from "@/actions/provider.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocalizedField, type ManagedProvider } from "@/types/provider.types";
import type { Locale } from "@/lib/i18n/config";

const initialState: ProviderActionState = { success: false };

function EditServiceForm({
  service,
  onCancel,
  onSaved,
}: {
  service: ManagedProvider["services"][number];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("business.services");
  const [state, formAction, pending] = useActionState(updateServiceAction, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="serviceId" value={service.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("nameAr")}</Label>
          <Input name="nameAr" defaultValue={service.name.ar} required dir="rtl" />
        </div>
        <div className="space-y-1">
          <Label>{t("nameEn")}</Label>
          <Input name="nameEn" defaultValue={service.name.en} required />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending} className="gap-2">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("save")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

export function ProviderServicesManager({ provider }: { provider: ManagedProvider }) {
  const t = useTranslations("business.services");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [addState, addAction, addPending] = useActionState(addServiceAction, initialState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("list")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {provider.services.map((service) => (
              <li key={service.id} className="rounded-lg border p-4">
                {editingId === service.id ? (
                  <EditServiceForm
                    service={service}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{getLocalizedField(service.name, locale)}</span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingId(service.id)}
                        aria-label={t("edit")}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={pendingDelete === service.id}
                        onClick={async () => {
                          setPendingDelete(service.id);
                          await deleteServiceAction(service.id);
                          setPendingDelete(null);
                          router.refresh();
                        }}
                        aria-label={t("remove")}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <form action={addAction} className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">{t("addNew")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="nameAr">{t("nameAr")}</Label>
                <Input id="nameAr" name="nameAr" required dir="rtl" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nameEn">{t("nameEn")}</Label>
                <Input id="nameEn" name="nameEn" required />
              </div>
            </div>
            {addState.error ? (
              <p className="text-sm text-destructive">{t(`errors.${addState.error}` as "errors.unknown")}</p>
            ) : null}
            {addState.success ? (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{t("added")}</p>
            ) : null}
            <Button type="submit" disabled={addPending} className="gap-2">
              {addPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {t("add")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
