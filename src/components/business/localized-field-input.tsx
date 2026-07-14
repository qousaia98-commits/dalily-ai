"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { previewLocalizedFieldAction } from "@/actions/translation.actions";
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

  const fieldProps = {
    id,
    name,
    defaultValue,
    required,
    disabled: disabled || isPending,
    onBlur: handleBlur,
    dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const),
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? <Textarea {...fieldProps} rows={rows} /> : <Input {...fieldProps} />}
      {isPending ? <p className="text-xs text-muted-foreground">{t("translating")}</p> : null}
      {preview ? (
        <p className="text-xs text-muted-foreground">{t("preview", { text: preview })}</p>
      ) : null}
    </div>
  );
}
