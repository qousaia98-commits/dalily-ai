import { cn } from "@/lib/utils";
import { GeometricPattern } from "@/components/brand/geometric-pattern";

type PatternBackdropProps = {
  className?: string;
  /** Keep the soft gold radial wash from the design system. Default true. */
  wash?: boolean;
  patternOpacity?: number;
  density?: "sparse" | "normal" | "dense";
  color?: "gold" | "navy" | "foreground";
};

/**
 * Stacks geometric texture under `dalily-section-wash`.
 * Wash stays on top of the pattern so text contrast is preserved.
 */
export function PatternBackdrop({
  className,
  wash = true,
  patternOpacity = 0.055,
  density = "sparse",
  color = "gold",
}: PatternBackdropProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <GeometricPattern
        className="absolute inset-0 size-full"
        opacity={patternOpacity}
        density={density}
        color={color}
      />
      {wash ? (
        <div className="absolute inset-0 dalily-section-wash" />
      ) : null}
    </div>
  );
}
