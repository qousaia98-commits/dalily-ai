import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand/tokens";
import { DalilyMark } from "@/components/brand/dalily-mark";

type DalilyLogoProps = {
  className?: string;
  /** compact: mark + Dalily | full: mark + Dalily + دليلي | mark: symbol only */
  variant?: "compact" | "full" | "mark";
  /** For surfaces with forced light/dark backgrounds (auth splash, OG) */
  onDark?: boolean;
};

export function DalilyLogo({ className, variant = "compact", onDark }: DalilyLogoProps) {
  if (variant === "mark") {
    return (
      <DalilyMark
        className={className}
        size={36}
        color={onDark ? "light" : undefined}
      />
    );
  }

  const titleClass = onDark
    ? "text-white"
    : "text-[var(--dalily-navy)] dark:text-white";
  const arabicClass = onDark
    ? "text-white/70"
    : "text-[var(--dalily-text-secondary)] dark:text-white/70";

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <DalilyMark size={36} color={onDark ? "light" : undefined} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-sans text-base font-bold tracking-tight sm:text-lg",
            titleClass,
          )}
        >
          {BRAND.name}
        </span>
        {variant === "full" ? (
          <span
            className={cn(
              "mt-0.5 font-arabic text-xs font-medium sm:text-sm",
              arabicClass,
            )}
            dir="rtl"
          >
            {BRAND.nameAr}
          </span>
        ) : null}
      </span>
    </span>
  );
}
