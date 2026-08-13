import {
  brandIllustrationProps,
  ILLUSTRATION_STROKE,
  STROKE_WIDTH,
  type BrandIllustrationProps,
} from "./shared";

/** No messages yet — paired bubbles, mirrored so RTL-safe. */
export function EmptyMessagesIllustration({
  className,
  ...props
}: BrandIllustrationProps) {
  return (
    <svg {...brandIllustrationProps(className)} {...props}>
      <rect
        x="18"
        y="22"
        width="48"
        height="34"
        rx="12"
        fill={ILLUSTRATION_STROKE.softFill}
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
      />
      <path
        d="M30 56l4-6h8"
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        fill={ILLUSTRATION_STROKE.softFill}
      />
      <path
        d="M28 34h24M28 42h16"
        stroke={ILLUSTRATION_STROKE.main}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        opacity={0.4}
      />
      <rect
        x="54"
        y="40"
        width="48"
        height="34"
        rx="12"
        fill={ILLUSTRATION_STROKE.mutedFill}
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={STROKE_WIDTH}
      />
      <path
        d="M90 74l-4-6h-8"
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
        fill={ILLUSTRATION_STROKE.mutedFill}
      />
      <path
        d="M66 52h24M66 60h14"
        stroke={ILLUSTRATION_STROKE.accent}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        opacity={0.55}
      />
    </svg>
  );
}
