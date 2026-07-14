/** Approved Dalily symbol — star + swoosh + gold destination (reference lockup) */
export const MARK_VIEWBOX = "0 0 48 48";

/** Four-point sparkle — Dalily finds */
export const MARK_STAR_PATH =
  "M9 15.5L10.4 19.6L14.5 21L10.4 22.4L9 26.5L7.6 22.4L3.5 21L7.6 19.6Z";

/** Flowing journey curve — problem to solution */
export const MARK_SWOOSH_PATH =
  "M12.5 33C13.5 27 17 19 24 14.5C27 12.5 29.5 11.5 31.5 11L32.8 13.2C30.5 14 28 15.5 25.5 17.5C19 22.5 15 28.5 14 34.5Z";

export const MARK_GOLD_CX = 35.5;
export const MARK_GOLD_CY = 8.5;
export const MARK_GOLD_R = 3;

export function markSvgGroup(options: {
  ink: string;
  gold?: string;
}): string {
  const gold = options.gold ?? "#C4A052";
  return `<g>
    <path fill="${options.ink}" d="${MARK_STAR_PATH}"/>
    <path fill="${options.ink}" d="${MARK_SWOOSH_PATH}"/>
    <circle cx="${MARK_GOLD_CX}" cy="${MARK_GOLD_CY}" r="${MARK_GOLD_R}" fill="${gold}"/>
  </g>`;
}

export function horizontalLogoSvg(options: {
  ink: string;
  gold: string;
  muted: string;
  bg?: string;
  width?: number;
  height?: number;
}): string {
  const w = options.width ?? 420;
  const h = options.height ?? 120;
  const bg = options.bg ? `<rect width="${w}" height="${h}" fill="${options.bg}"/>` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-label="Dalily">
  ${bg}
  <g transform="translate(8, 14) scale(1.35)">
    ${markSvgGroup({ ink: options.ink, gold: options.gold })}
  </g>
  <text x="88" y="52" fill="${options.ink}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="34" font-weight="700" letter-spacing="-0.02em">Dalily</text>
  <text x="88" y="82" fill="${options.gold}" font-family="'Noto Sans Arabic', Tahoma, sans-serif" font-size="20" font-weight="500">&#x062F;&#x0644;&#x064A;&#x0644;&#x064A;</text>
  <text x="88" y="108" fill="${options.muted}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.16em">FROM PROBLEM </text>
  <text x="214" y="108" fill="${options.gold}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.16em">TO </text>
  <text x="236" y="108" fill="${options.muted}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.16em">SOLUTION</text>
</svg>`;
}

export function appIconSvg(options: { bg: string; ink: string; gold?: string; size?: number; radius?: number }): string {
  const size = options.size ?? 512;
  const radius = options.radius ?? 112;
  const gold = options.gold ?? "#C4A052";
  const scale = size / 512;
  const pad = 112 * scale;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none" role="img" aria-label="Dalily">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${options.bg}"/>
  <g transform="translate(${pad}, ${pad}) scale(${6 * scale})">
    ${markSvgGroup({ ink: options.ink, gold })}
  </g>
</svg>`;
}
