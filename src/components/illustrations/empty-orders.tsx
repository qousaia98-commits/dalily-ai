import {
  brandIllustrationProps,
  ILLUSTRATION_STROKE,
  STROKE_WIDTH,
  type BrandIllustrationProps,
} from "./shared";

/** Empty orders / no requests yet — clipboard stack, no directional cues. */
export function EmptyOrdersIllustration({
  className,
  ...props
}: BrandIllustrationProps) {
  return (
    <svg {...brandIllustrationProps(className)} {...props}>
      <rect
        x="34"
        y="18"
        width="52"
        height="64"
        rx="6"
        fill={ILLUSTRATION_STROKE.softFill}
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
      />
      <rect
        x="28"
        y="24"
        width="52"
        height="64"
        rx="6"
        fill={ILLUSTRATION_STROKE.mutedFill}
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
      />
      <path
        d="M40 38h28M40 48h22M40 58h26"
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        opacity={0.55}
      />
      <circle
        cx="78"
        cy="30"
        r="10"
        fill={ILLUSTRATION_STROKE.mutedFill}
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={STROKE_WIDTH}
      />
      <path
        d="M78 26v8M74 30h8"
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
}
