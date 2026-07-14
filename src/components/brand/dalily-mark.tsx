import { cn } from "@/lib/utils";
import { BRAND, DALILY_MARK_PATH } from "@/lib/brand/tokens";

type DalilyMarkProps = {
  className?: string;
  size?: number;
  /** Mark ink color — defaults to currentColor */
  color?: "inherit" | "light" | "dark";
};

export function DalilyMark({ className, size = 32, color = "inherit" }: DalilyMarkProps) {
  const markFill =
    color === "light" ? BRAND.colors.white : color === "dark" ? BRAND.colors.navy : "currentColor";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path fillRule="evenodd" clipRule="evenodd" fill={markFill} d={DALILY_MARK_PATH} />
      <circle cx="26.6" cy="24" r="2.1" fill={BRAND.colors.gold} />
    </svg>
  );
}
