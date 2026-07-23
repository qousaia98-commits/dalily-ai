"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import {
  collectClientFieldErrors,
  fieldErrorId,
  focusFirstInvalidField,
  type ClientFieldErrors,
} from "@/lib/forms/client-validation";

type Options = {
  /** Optional prefix so multiple forms on one page don't clash error element ids. */
  formId?: string;
};

/**
 * Client validation UX for forms that use server actions.
 * Call `guardSubmit` from `onSubmit`; when it returns false, native submit/action is blocked.
 */
export function useClientFormValidation(options: Options = {}) {
  const t = useTranslations("common.validation");
  const [fieldErrors, setFieldErrors] = useState<ClientFieldErrors>({});
  const formId = options.formId;

  const clearFieldError = useCallback((name: string) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const clearAllErrors = useCallback(() => setFieldErrors({}), []);

  const validateForm = useCallback(
    (form: HTMLFormElement): boolean => {
      const errors = collectClientFieldErrors(form, {
        required: t("required"),
        email: t("email"),
        minLength: t("minLength"),
        selectRequired: t("selectRequired"),
      });
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        focusFirstInvalidField(form, errors);
        return false;
      }
      setFieldErrors({});
      return true;
    },
    [t],
  );

  const guardSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>): boolean => {
      const ok = validateForm(event.currentTarget);
      if (!ok) {
        event.preventDefault();
        return false;
      }
      return true;
    },
    [validateForm],
  );

  const getFieldA11y = useCallback(
    (name: string) => {
      const invalid = Boolean(fieldErrors[name]);
      const id = fieldErrorId(name, formId);
      return {
        "aria-invalid": invalid || undefined,
        "aria-describedby": invalid ? id : undefined,
      } as const;
    },
    [fieldErrors, formId],
  );

  /** Mark a control as required for Dalily validation (never sets HTML `required`). */
  const requiredAttr = {
    "data-required": true,
    "aria-required": true,
  } as const;

  return {
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    clearAllErrors,
    validateForm,
    guardSubmit,
    getFieldA11y,
    requiredAttr,
    errorId: (name: string) => fieldErrorId(name, formId),
  };
}
