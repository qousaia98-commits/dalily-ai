import { cn } from "@/lib/utils";
import type { PlanSlug } from "@/lib/subscription/types";

type PlanBadgeProps = {
  planSlug: PlanSlug | string;
  label: string;
  className?: string;
};

/**
 * Starter = gray, PRO = gold, PREMIUM = dark navy + gold.
 */
export function PlanBadge({ planSlug, label, className }: PlanBadgeProps) {
  const slug = planSlug === "free" ? "starter" : planSlug;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase",
        slug === "premium" &&
          "border border-[var(--dalily-gold)] bg-[var(--dalily-navy)] text-[var(--dalily-gold)]",
        slug === "pro" &&
          "bg-[var(--dalily-gold)] text-[var(--dalily-navy)]",
        (slug === "starter" || slug === "free") &&
          "bg-muted text-muted-foreground",
        className,
      )}
    >
      {label}
    </span>
  );
}
