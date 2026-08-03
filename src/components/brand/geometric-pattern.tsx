"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type PatternColor = "gold" | "navy" | "foreground";
type PatternDensity = "sparse" | "normal" | "dense";

const DENSITY_SIZE: Record<PatternDensity, number> = {
  sparse: 64,
  normal: 48,
  dense: 36,
};

type GeometricPatternProps = {
  className?: string;
  /** 0–1 visual strength; keep ≤0.1 for full-bleed behind text. */
  opacity?: number;
  density?: PatternDensity;
  color?: PatternColor;
};

/**
 * Abstract 8-point star tessellation — modernized Islamic geometry motif.
 * Pure SVG; theme-aware via CSS variables. Decorative only (aria-hidden).
 */
export function GeometricPattern({
  className,
  opacity = 0.07,
  density = "normal",
  color = "gold",
}: GeometricPatternProps) {
  const uid = useId().replace(/:/g, "");
  const patternId = `dalily-geo-${uid}`;
  const tile = DENSITY_SIZE[density];

  const stroke =
    color === "gold"
      ? "var(--dalily-gold)"
      : color === "navy"
        ? "var(--dalily-navy)"
        : "currentColor";

  // Simplified 8-point star (khatam) — outline only, centered in tile
  const cx = tile / 2;
  const cy = tile / 2;
  const outer = tile * 0.32;
  const inner = tile * 0.14;
  const starPoints = Array.from({ length: 8 }, (_, i) => {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
  }).join(" ");

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none select-none", className)}
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      style={{ opacity }}
    >
      <defs>
        <pattern
          id={patternId}
          width={tile}
          height={tile}
          patternUnits="userSpaceOnUse"
        >
          <polygon
            points={starPoints}
            fill="none"
            stroke={stroke}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          {/* Soft diamond connectors — modern grid, not carpet tiling */}
          <path
            d={`M${cx} 2 L${cx} ${cy - outer - 2} M${cx} ${cy + outer + 2} L${cx} ${tile - 2} M2 ${cy} L${cx - outer - 2} ${cy} M${cx + outer + 2} ${cy} L${tile - 2} ${cy}`}
            stroke={stroke}
            strokeWidth={0.6}
            strokeLinecap="round"
            opacity={0.45}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
