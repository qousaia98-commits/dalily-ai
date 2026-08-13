import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "size-20",
  md: "size-28",
  lg: "size-36",
} as const;

type IllustrationFrameProps = {
  children: ReactNode;
  className?: string;
  size?: keyof typeof SIZE;
};

/** Modest frame for brand illustrations — never a full-page takeover. */
export function IllustrationFrame({
  children,
  className,
  size = "md",
}: IllustrationFrameProps) {
  return (
    <div
      className={cn(
        "relative mx-auto flex items-center justify-center",
        SIZE[size],
        className,
      )}
      aria-hidden
    >
      {children}
    </div>
  );
}

export type BrandIllustrationProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

/** Shared SVG attrs for the illustration family (stroke + gold accent). */
export function brandIllustrationProps(
  className?: string,
): Pick<
  SVGProps<SVGSVGElement>,
  "viewBox" | "fill" | "xmlns" | "aria-hidden" | "className"
> {
  return {
    viewBox: "0 0 120 100",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
    className: cn("size-full text-foreground", className),
  };
}

export const ILLUSTRATION_STROKE = {
  main: "currentColor",
  accent: "var(--dalily-gold)",
  mutedFill: "color-mix(in oklab, var(--dalily-gold) 14%, transparent)",
  softFill: "color-mix(in oklab, currentColor 6%, transparent)",
} as const;

export const STROKE_WIDTH = 1.75;
