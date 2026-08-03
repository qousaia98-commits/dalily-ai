import {
  brandIllustrationProps,
  ILLUSTRATION_STROKE,
  STROKE_WIDTH,
  type BrandIllustrationProps,
} from "./shared";
import { cn } from "@/lib/utils";

/**
 * Unlock / offer accepted — two interlocking rings with a gold node.
 * Non-directional (safe in RTL without flipping).
 */
export function UnlockSuccessIllustration({
  className,
  ...props
}: BrandIllustrationProps) {
  const base = brandIllustrationProps(className);
  return (
    <svg
      {...base}
      {...props}
      className={cn(base.className, "animate-success-enter")}
    >
      <circle
        cx="46"
        cy="50"
        r="22"
        fill={ILLUSTRATION_STROKE.softFill}
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
      />
      <circle
        className="animate-success-soft-pop"
        cx="74"
        cy="50"
        r="22"
        fill={ILLUSTRATION_STROKE.mutedFill}
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={STROKE_WIDTH}
      />
      <circle
        cx="60"
        cy="50"
        r="8"
        fill="var(--background)"
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={STROKE_WIDTH}
      />
      <path
        className="animate-draw-check"
        pathLength={1}
        d="M56 50l2.8 2.8L66 46"
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M60 18l1.6 4.2L66 24l-4.4 1.6L60 30l-1.6-4.4L54 24l4.4-1.8Z"
        fill={ILLUSTRATION_STROKE.mutedFill}
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={1.25}
        strokeLinejoin="round"
      />
    </svg>
  );
}
