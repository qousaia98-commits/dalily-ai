import {
  brandIllustrationProps,
  ILLUSTRATION_STROKE,
  STROKE_WIDTH,
  type BrandIllustrationProps,
} from "./shared";

/** Waiting room — no offers yet. Open tray + soft geometric frame (symmetric). */
export function EmptyOffersIllustration({
  className,
  ...props
}: BrandIllustrationProps) {
  return (
    <svg {...brandIllustrationProps(className)} {...props}>
      <rect
        x="22"
        y="28"
        width="76"
        height="48"
        rx="10"
        fill={ILLUSTRATION_STROKE.softFill}
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
      />
      <path
        d="M22 40h76"
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
        opacity={0.35}
      />
      <path
        d="M38 28V22a8 8 0 0 1 8-8h28a8 8 0 0 1 8 8v6"
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
      {/* Abstract 8-point spark — waiting signal, not an arrow */}
      <path
        d="M60 48l2.2 5.8L68 56l-5.8 2.2L60 64l-2.2-5.8L52 56l5.8-2.2Z"
        fill={ILLUSTRATION_STROKE.mutedFill}
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle
        cx="60"
        cy="56"
        r="22"
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={1}
        strokeDasharray="3 5"
        opacity={0.45}
      />
    </svg>
  );
}
