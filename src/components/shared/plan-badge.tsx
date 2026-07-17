import { cn } from "@/lib/utils";
import { resolvePlanDisplay } from "@/lib/subscription/benefit-engine";
import type { PlanSlug } from "@/lib/subscription/types";

type PlanBadgeProps = {
  planSlug: PlanSlug | string;
  /** Override label; defaults to Starter / ⭐ PRO / 👑 PREMIUM */
  label?: string;
  className?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
};

/**
 * Starter = gray · PRO = gold ⭐ · PREMIUM = navy + gold 👑
 */
export function PlanBadge({
  planSlug,
  label,
  className,
  size = "sm",
  showIcon = true,
}: PlanBadgeProps) {
  const display = resolvePlanDisplay(planSlug);
  const text =
    label ??
    (display.icon === "crown"
      ? "👑 PREMIUM"
      : display.icon === "star"
        ? "⭐ PRO"
        : "Starter");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-bold tracking-wide uppercase",
        size === "sm" && "px-2.5 py-0.5 text-[0.65rem]",
        size === "md" && "px-3 py-1 text-xs",
        display.marketingId === "premium" &&
          "border border-[var(--dalily-gold)] bg-[var(--dalily-navy)] text-[var(--dalily-gold)]",
        display.marketingId === "pro" &&
          "bg-[var(--dalily-gold)] text-[var(--dalily-navy)]",
        display.marketingId === "starter" && "bg-muted text-muted-foreground",
        className,
      )}
      aria-label={display.label}
    >
      {showIcon && display.icon === "none" ? null : null}
      {text}
    </span>
  );
}

/** Name + plan badge composition used across surfaces. */
export function NamedPlanHeading({
  name,
  planSlug,
  as: Tag = "h1",
  className,
  badgeClassName,
}: {
  name: string;
  planSlug: PlanSlug | string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  badgeClassName?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-2", className)}>
      <Tag className="min-w-0 truncate font-bold tracking-tight text-[var(--dalily-navy)]">
        {name}
      </Tag>
      <PlanBadge planSlug={planSlug} className={badgeClassName} />
    </span>
  );
}
