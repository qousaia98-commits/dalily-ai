import {
  brandIllustrationProps,
  ILLUSTRATION_STROKE,
  STROKE_WIDTH,
  type BrandIllustrationProps,
} from "./shared";

/** Request published — document + centered check. Fully symmetric success cue. */
export function RequestPublishedIllustration({
  className,
  ...props
}: BrandIllustrationProps) {
  return (
    <svg {...brandIllustrationProps(className)} {...props}>
      <rect
        x="36"
        y="14"
        width="48"
        height="62"
        rx="8"
        fill={ILLUSTRATION_STROKE.softFill}
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
      />
      <path
        d="M46 30h28M46 40h22M46 50h18"
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        opacity={0.45}
      />
      <circle
        cx="60"
        cy="72"
        r="16"
        fill={ILLUSTRATION_STROKE.mutedFill}
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={STROKE_WIDTH}
      />
      <path
        d="M52 72l5.5 5.5L70 65"
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Soft radial ticks — celebration without directional arrows */}
      <path
        d="M60 8v4M60 88v4M28 50h4M88 50h4M38 22l2.5 2.5M79.5 75.5L82 78M38 78l2.5-2.5M79.5 24.5L82 22"
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.55}
      />
    </svg>
  );
}
