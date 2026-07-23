"use client";

import { Star } from "lucide-react";
import { FieldError } from "@/components/forms/field-error";
import { cn } from "@/lib/utils";

type Props = {
  name?: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
  errorMessage?: string | null;
  formId?: string;
};

export function InteractiveStarRating({
  name = "rating",
  value,
  onChange,
  disabled,
  label,
  errorMessage,
  formId,
}: Props) {
  const errorId = formId ? `${formId}-${name}-error` : `${name}-error`;

  return (
    <fieldset className="space-y-2" disabled={disabled} aria-describedby={errorMessage ? errorId : undefined}>
      <legend className="text-sm font-medium">{label}</legend>
      <input
        type="hidden"
        name={name}
        value={value || ""}
        data-required
        aria-required={true}
        aria-invalid={Boolean(errorMessage) || undefined}
      />
      <div
        className="flex gap-1"
        role="radiogroup"
        aria-label={label}
        aria-invalid={Boolean(errorMessage) || undefined}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const active = n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n}`}
              className={cn(
                "flex size-11 items-center justify-center rounded-xl border transition",
                active
                  ? "border-amber-400 bg-amber-400/15 text-amber-500"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
              onClick={() => onChange(n)}
            >
              <Star className={cn("size-5", active && "fill-amber-400")} aria-hidden />
            </button>
          );
        })}
      </div>
      <FieldError name={name} formId={formId} message={errorMessage} />
    </fieldset>
  );
}
