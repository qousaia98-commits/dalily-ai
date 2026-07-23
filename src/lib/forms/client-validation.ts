/**
 * Client-side required-field checks that replace native HTML5 constraint validation.
 * Pair with `<form noValidate>` and `data-required` / `aria-required="true"` on fields.
 */

export type ClientFieldErrors = Record<string, string>;

export type ClientValidationMessages = {
  required: string;
  email?: string;
  minLength?: string;
  selectRequired?: string;
};

type FieldLike = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isFieldLike(el: Element): el is FieldLike {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

function isEmpty(el: FieldLike): boolean {
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") {
      const group = el.form?.elements.namedItem(el.name);
      if (group && "length" in group) {
        return !Array.from(group as RadioNodeList).some(
          (node) => node instanceof HTMLInputElement && node.checked,
        );
      }
      return !el.checked;
    }
    if (el.type === "file") {
      return !el.files || el.files.length === 0;
    }
  }
  return el.value.trim().length === 0;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Find controls marked as required for Dalily validation (never use HTML `required`). */
export function queryRequiredFields(form: HTMLFormElement): FieldLike[] {
  const nodes = form.querySelectorAll<Element>("[data-required],[aria-required='true']");
  const seen = new Set<string>();
  const fields: FieldLike[] = [];

  for (const el of nodes) {
    if (!isFieldLike(el) || el.disabled || !el.name) continue;
    // One error per radio/checkbox group name
    if (
      el instanceof HTMLInputElement &&
      (el.type === "radio" || el.type === "checkbox") &&
      seen.has(el.name)
    ) {
      continue;
    }
    seen.add(el.name);
    fields.push(el);
  }

  return fields;
}

export function collectClientFieldErrors(
  form: HTMLFormElement,
  messages: ClientValidationMessages,
): ClientFieldErrors {
  const errors: ClientFieldErrors = {};

  for (const el of queryRequiredFields(form)) {
    if (isEmpty(el)) {
      const isSelect = el instanceof HTMLSelectElement;
      errors[el.name] =
        isSelect && messages.selectRequired ? messages.selectRequired : messages.required;
      continue;
    }

    if (
      el instanceof HTMLInputElement &&
      el.type === "email" &&
      messages.email &&
      !isValidEmail(el.value.trim())
    ) {
      errors[el.name] = messages.email;
      continue;
    }

    if (
      "minLength" in el &&
      el.minLength > 0 &&
      el.value.trim().length < el.minLength &&
      messages.minLength
    ) {
      errors[el.name] = messages.minLength;
    }
  }

  return errors;
}

export function focusFirstInvalidField(form: HTMLFormElement, errors: ClientFieldErrors): void {
  const firstName = Object.keys(errors)[0];
  if (!firstName) return;
  const el = form.elements.namedItem(firstName);
  const target =
    el instanceof RadioNodeList
      ? (Array.from(el).find((n) => n instanceof HTMLElement) as HTMLElement | undefined)
      : el instanceof HTMLElement
        ? el
        : null;
  target?.focus?.();
}

export function fieldErrorId(name: string, formId?: string): string {
  return formId ? `${formId}-${name}-error` : `${name}-error`;
}
