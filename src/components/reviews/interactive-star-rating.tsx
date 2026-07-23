"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  name?: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
};

export function InteractiveStarRating({
  name = "rating",
  value,
  onChange,
  disabled,
  label,
}: Props) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{label}</legend>
      <input type="hidden" name={name} value={value || ""} required />
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
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
    </fieldset>
  );
}
