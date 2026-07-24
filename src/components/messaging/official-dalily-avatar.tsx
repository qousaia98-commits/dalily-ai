import { cn } from "@/lib/utils";
import { DalilyMark } from "@/components/brand/dalily-mark";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<Size, string> = {
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
  xl: "size-20",
};

const MARK_SIZE: Record<Size, number> = {
  sm: 18,
  md: 22,
  lg: 28,
  xl: 40,
};

/**
 * Official Dalily conversation avatar.
 * Uses the Dalily brand mark on a navy circle (professional system profile).
 */
export function OfficialDalilyAvatar({
  size = "md",
  className,
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "bg-[var(--dalily-navy)] text-white ring-1 ring-[var(--dalily-gold)]/30",
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden
    >
      <DalilyMark size={MARK_SIZE[size]} color="light" />
    </span>
  );
}

/** Clean placeholder when a mark is unavailable — blue circle, white D. */
export function OfficialDalilyLetterAvatar({
  size = "md",
  className,
}: {
  size?: Size;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[#1D4ED8] font-bold text-white",
        SIZE_CLASS[size],
        size === "sm" && "text-sm",
        size === "md" && "text-base",
        size === "lg" && "text-xl",
        size === "xl" && "text-3xl",
        className,
      )}
      aria-hidden
    >
      D
    </span>
  );
}
