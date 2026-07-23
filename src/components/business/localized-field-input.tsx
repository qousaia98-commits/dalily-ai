"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { previewLocalizedFieldAction } from "@/actions/translation.actions";
import { FieldError } from "@/components/forms/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Locale } from "@/lib/i18n/config";

type LocalizedFieldInputProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  existingAr?: string;
  existingEn?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
  formId?: string;
  onValueChange?: () => void;
};

export function LocalizedFieldInput({
  id,
  name,
  label,
  defaultValue = "",
  existingAr = "",
  existingEn = "",
  multiline = false,
  rows = 4,
  required = false,
  disabled = false,
  errorMessage,
  formId,
  onValueChange,
}: LocalizedFieldInputProps) {
  const locale = useLocale() as Locale;
  const t = useTranslations("business.translation");
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const text = event.target.value;
    if (!text.trim()) {
      setPreview(null);
      return;
    }

    startTransition(async () => {
      const result = await previewLocalizedFieldAction(locale, text, existingAr, existingEn);
      if (result.success && result.result) {
        const opposite = locale === "ar" ? result.result.en : result.result.ar;
        setPreview(opposite?.trim() ? opposite : null);
      }
    });
  };

  const errorId = formId ? `${formId}-${name}-error` : `${name}-error`;

  const fieldProps = {
    id,
    name,
    defaultValue,
    ...(required
      ? ({ "data-required": true, "aria-required": true } as const)
      : {}),
    disabled: disabled || isPending,
    onBlur: handleBlur,
    onChange: onValueChange,
    dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const),
    "aria-invalid": Boolean(errorMessage) || undefined,
    "aria-describedby": errorMessage ? errorId : undefined,
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? <Textarea {...fieldProps} rows={rows} /> : <Input {...fieldProps} />}
      <FieldError name={name} formId={formId} message={errorMessage} />
      {isPending ? <p className="text-xs text-muted-foreground">{t("translating")}</p> : null}
      {preview ? (
        <p className="text-xs text-muted-foreground">{t("preview", { text: preview })}</p>
      ) : null}
    </div>
  );
}
