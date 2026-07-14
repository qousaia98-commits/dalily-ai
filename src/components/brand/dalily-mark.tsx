import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand/tokens";
import {
  MARK_GOLD_CX,
  MARK_GOLD_CY,
  MARK_GOLD_R,
  MARK_STAR_PATH,
  MARK_SWOOSH_PATH,
  MARK_VIEWBOX,
} from "@/lib/brand/mark-svg";

type DalilyMarkProps = {
  className?: string;
  size?: number;
  color?: "inherit" | "light" | "dark";
};

export function DalilyMark({ className, size = 32, color = "inherit" }: DalilyMarkProps) {
  const ink =
    color === "light" ? BRAND.colors.white : color === "dark" ? BRAND.colors.navy : "currentColor";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={MARK_VIEWBOX}
      fill="none"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path fill={ink} d={MARK_STAR_PATH} />
      <path fill={ink} d={MARK_SWOOSH_PATH} />
      <circle cx={MARK_GOLD_CX} cy={MARK_GOLD_CY} r={MARK_GOLD_R} fill={BRAND.colors.gold} />
    </svg>
  );
}
