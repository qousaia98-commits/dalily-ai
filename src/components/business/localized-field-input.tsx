"use client";

import { useEffect, useRef, useState } from "react";
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
  const [isPending, setIsPending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchPreview = (text: string) => {
    setIsPending(true);
    previewLocalizedFieldAction(locale, text, existingAr, existingEn)
      .then((result) => {
        if (result.success && result.result) {
          const opposite = locale === "ar" ? result.result.en : result.result.ar;
          setPreview(opposite?.trim() ? opposite : null);
        }
      })
      .finally(() => setIsPending(false));
  };

  // Debounced off typing (not blur): triggering this fresh the instant the
  // user blurs the field — which is exactly what happens when they click a
  // submit button right after typing — raced this request against the
  // form's own submit action. Both are separate POSTs to the same route,
  // and firing them back-to-back could leave the submit's response
  // unprocessed, so the form silently appeared to do nothing. Debouncing off
  // keystrokes means the preview request has normally already completed
  // well before the user ever reaches for the submit button.
  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onValueChange?.();
    const text = event.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    debounceRef.current = setTimeout(() => fetchPreview(text), 500);
  };

  const errorId = formId ? `${formId}-${name}-error` : `${name}-error`;

  const fieldProps = {
    id,
    name,
    defaultValue,
    ...(required
      ? ({ "data-required": true, "aria-required": true } as const)
      : {}),
    // NOTE: intentionally NOT tied to `isPending` (the background translation
    // preview's own transition). A disabled field's value is excluded from
    // FormData on submit, and the client-side required-field check also
    // skips disabled fields (src/lib/forms/client-validation.ts) — so
    // disabling this input while a preview request is in flight let a submit
    // right after typing go out with an empty/missing value, silently.
    disabled,
    onChange: handleChange,
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
