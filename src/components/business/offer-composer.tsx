"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createOfferAction,
  saveOfferTemplateAction,
  type OfferActionState,
} from "@/actions/offer.actions";
import type { OfferTemplateView } from "@/domains/offer/types";

const initial: OfferActionState = { success: false };

export function OfferComposer({
  matchAssignmentId,
  serviceRequestId,
  templates,
  existingOfferId,
}: {
  matchAssignmentId: string;
  serviceRequestId: string;
  templates: OfferTemplateView[];
  existingOfferId: string | null;
}) {
  const t = useTranslations("offerFlow");
  const router = useRouter();
  const [state, action, pending] = useActionState(createOfferAction, initial);
  const [templateState, templateAction, templatePending] = useActionState(
    saveOfferTemplateAction,
    initial,
  );
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("SYP");
  const [priceModel, setPriceModel] = useState("fixed");
  const [inclusions, setInclusions] = useState("");
  const [etaText, setEtaText] = useState("");
  const [message, setMessage] = useState("");
  const [templateId, setTemplateId] = useState("");

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((x) => x.id === id);
    if (!tpl) return;
    if (tpl.price != null) setPrice(String(tpl.price));
    setCurrency(tpl.currency || "SYP");
    setPriceModel(tpl.priceModel);
    setInclusions(tpl.inclusions || "");
    setEtaText(tpl.etaText || "");
    setMessage(tpl.message || "");
  };

  if (existingOfferId) {
    return (
      <div
        className="space-y-2 rounded-2xl border border-[var(--dalily-gold)]/30 bg-[color-mix(in_oklab,var(--dalily-gold)_8%,var(--card))] px-4 py-4"
        role="status"
      >
        <p className="text-sm font-semibold text-foreground">{t("provider.offerSentTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("provider.offerSentBody")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {templates.length > 0 ? (
        <div className="space-y-2">
          <Label>{t("provider.useTemplate")}</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={templateId === "" ? "default" : "outline"}
              onClick={() => {
                setTemplateId("");
                setPrice("");
                setCurrency("SYP");
                setPriceModel("fixed");
                setInclusions("");
                setEtaText("");
                setMessage("");
              }}
            >
              {t("provider.noTemplate")}
            </Button>
            {templates.map((tpl) => (
              <Button
                key={tpl.id}
                type="button"
                size="sm"
                variant={templateId === tpl.id ? "default" : "outline"}
                onClick={() => applyTemplate(tpl.id)}
              >
                {tpl.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <form action={action} className="space-y-3 rounded-2xl border border-border p-4">
        <input type="hidden" name="matchAssignmentId" value={matchAssignmentId} />
        <input type="hidden" name="serviceRequestId" value={serviceRequestId} />
        <input type="hidden" name="templateId" value={templateId} />
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {t("provider.composeTitle")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="price">{t("fields.price")}</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">{t("fields.currency")}</Label>
            <Input
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priceModel">{t("fields.priceModel")}</Label>
          <select
            id="priceModel"
            name="priceModel"
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            value={priceModel}
            onChange={(e) => setPriceModel(e.target.value)}
          >
            <option value="fixed">{t("priceModel.fixed")}</option>
            <option value="hourly">{t("priceModel.hourly")}</option>
            <option value="estimate">{t("priceModel.estimate")}</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="etaText">{t("fields.eta")}</Label>
          <Input
            id="etaText"
            name="etaText"
            value={etaText}
            onChange={(e) => setEtaText(e.target.value)}
            className="rounded-xl"
            placeholder={t("provider.etaPlaceholder")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inclusions">{t("fields.inclusions")}</Label>
          <Textarea
            id="inclusions"
            name="inclusions"
            value={inclusions}
            onChange={(e) => setInclusions(e.target.value)}
            className="rounded-xl"
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="message">{t("fields.message")}</Label>
          <Textarea
            id="message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rounded-xl"
            rows={3}
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full rounded-xl">
          {t("provider.submit")}
        </Button>
        {state.qualityFlags && state.qualityFlags.length > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">{t("quality.nudge")}</p>
        ) : null}
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {t(`errors.${state.error}` as "errors.failed")}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-muted-foreground">{t("provider.success")}</p>
        ) : null}
      </form>

      <form action={templateAction} className="space-y-2 rounded-2xl border border-dashed border-border p-4">
        <p className="text-sm font-medium">{t("provider.saveTemplate")}</p>
        <Input name="label" placeholder={t("provider.templateLabel")} className="rounded-xl" required />
        <input type="hidden" name="price" value={price} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="priceModel" value={priceModel} />
        <input type="hidden" name="inclusions" value={inclusions} />
        <input type="hidden" name="etaText" value={etaText} />
        <input type="hidden" name="message" value={message} />
        <Button type="submit" variant="outline" size="sm" disabled={templatePending} className="rounded-xl">
          {t("provider.saveTemplateCta")}
        </Button>
        {templateState.success ? (
          <p className="text-xs text-muted-foreground">{t("provider.templateSaved")}</p>
        ) : null}
      </form>
    </div>
  );
}
