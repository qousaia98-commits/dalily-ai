import { cn } from "@/lib/utils";
import { formatBadgeCount } from "@/lib/badges/format";

/**
 * Reusable count pill for nav / tabs / section headers.
 */
export function NavCountBadge({
  count,
  className,
  label,
}: {
  count: number;
  className?: string;
  /** Accessible label, e.g. "3 unread messages" */
  label?: string;
}) {
  const text = formatBadgeCount(count);
  if (!text) return null;

  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--dalily-gold)] px-1.5 py-0.5 text-[0.625rem] font-bold leading-none text-[var(--dalily-navy)] tabular-nums",
        className,
      )}
      aria-label={label ?? text}
    >
      {text}
    </span>
  );
}
