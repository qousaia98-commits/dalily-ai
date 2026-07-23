"use client";

import { fieldErrorId } from "@/lib/forms/client-validation";

type FieldErrorProps = {
  name: string;
  message?: string | null;
  formId?: string;
  className?: string;
};

/** Accessible inline field error for Dalily custom validation. */
export function FieldError({
  name,
  message,
  formId,
  className = "text-sm text-destructive",
}: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={fieldErrorId(name, formId)} role="alert" className={className}>
      {message}
    </p>
  );
}
