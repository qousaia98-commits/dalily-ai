import type { ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { GeometricPattern } from "@/components/brand/geometric-pattern";
import { cn } from "@/lib/utils";

type Cta = {
  href: string;
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
};

type Props = {
  /** Lucide icon fallback when no illustration is provided. */
  icon?: LucideIcon;
  /** Prefer brand illustration over Lucide icon when set. */
  illustration?: ReactNode;
  title: string;
  body: string;
  primary?: Cta;
  secondary?: Cta;
  className?: string;
};

/** Calm empty state with clear next step — used across hubs. */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  body,
  primary,
  secondary,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl border border-dashed border-border bg-muted/25 px-6 py-12 text-center",
        className,
      )}
    >
      <GeometricPattern
        className="absolute inset-0 size-full"
        opacity={0.045}
        density="sparse"
        color="gold"
      />
      <div className="relative flex flex-col items-center gap-5">
        {illustration ? (
          <div className="mx-auto size-28 shrink-0" aria-hidden>
            {illustration}
          </div>
        ) : Icon ? (
          <span className="flex size-16 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--dalily-gold)_14%,transparent)] text-[var(--dalily-gold)]">
            <Icon className="size-7" aria-hidden />
          </span>
        ) : null}
        <div className="max-w-sm space-y-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        {primary || secondary ? (
          <div className="flex w-full max-w-xs flex-col gap-2 sm:max-w-none sm:flex-row sm:justify-center">
            {primary ? (
              <Button
                asChild
                className="min-h-11 rounded-2xl"
                variant={primary.variant ?? "default"}
              >
                <Link href={primary.href}>{primary.label}</Link>
              </Button>
            ) : null}
            {secondary ? (
              <Button
                asChild
                className="min-h-11 rounded-2xl"
                variant={secondary.variant ?? "outline"}
              >
                <Link href={secondary.href}>{secondary.label}</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
