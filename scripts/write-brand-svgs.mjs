/**
 * Write production SVG brand assets — approved star + swoosh + gold mark.
 */
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const publicDir = resolve(root, "public");
const brandDir = resolve(root, "brand/assets");

const NAVY = "#0B1526";
const GOLD = "#C4A052";
const SURFACE = "#F7F8FA";
const MUTED = "#8A93A8";

const MARK_STAR =
  "M9 15.5L10.4 19.6L14.5 21L10.4 22.4L9 26.5L7.6 22.4L3.5 21L7.6 19.6Z";
const MARK_SWOOSH =
  "M12.5 33C13.5 27 17 19 24 14.5C27 12.5 29.5 11.5 31.5 11L32.8 13.2C30.5 14 28 15.5 25.5 17.5C19 22.5 15 28.5 14 34.5Z";

function markGroup(ink, gold = GOLD) {
  return `<path fill="${ink}" d="${MARK_STAR}"/>
    <path fill="${ink}" d="${MARK_SWOOSH}"/>
    <circle cx="35.5" cy="8.5" r="3" fill="${gold}"/>`;
}

function horizontalLogo({ ink, gold, muted, bg, w = 420, h = 120 }) {
  const rect = bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-label="Dalily">
  ${rect}
  <g transform="translate(8, 14) scale(1.35)">${markGroup(ink, gold)}</g>
  <text x="88" y="52" fill="${ink}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="34" font-weight="700" letter-spacing="-0.02em">Dalily</text>
  <text x="88" y="82" fill="${gold}" font-family="'Noto Sans Arabic', Tahoma, sans-serif" font-size="20" font-weight="500">&#x062F;&#x0644;&#x064A;&#x0644;&#x064A;</text>
  <text x="88" y="108" fill="${muted}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.16em">FROM PROBLEM </text>
  <text x="214" y="108" fill="${gold}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.16em">TO </text>
  <text x="236" y="108" fill="${muted}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.16em">SOLUTION</text>
</svg>`;
}

function appIcon({ bg, ink, size = 512, radius = 112 }) {
  const pad = 112;
  const scale = 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" fill="none" role="img" aria-label="Dalily">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
  <g transform="translate(${pad}, ${pad}) scale(${scale})">${markGroup(ink)}</g>
</svg>`;
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" role="img" aria-label="Dalily">
  <rect width="32" height="32" rx="7" fill="${NAVY}"/>
  <g transform="translate(2, 2) scale(0.58)">${markGroup("#F7F8FA")}</g>
</svg>`;

const ogImage = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" fill="none" role="img" aria-label="Dalily">
  <rect width="1200" height="630" fill="${NAVY}"/>
  <g transform="translate(340, 175) scale(2.15)">
    <g transform="translate(8, 14) scale(1.35)">${markGroup("#F7F8FA")}</g>
    <text x="88" y="52" fill="#F7F8FA" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="34" font-weight="700" letter-spacing="-0.02em">Dalily</text>
    <text x="88" y="82" fill="${GOLD}" font-family="'Noto Sans Arabic', Tahoma, sans-serif" font-size="20" font-weight="500">&#x062F;&#x0644;&#x064A;&#x0644;&#x064A;</text>
    <text x="88" y="108" fill="${MUTED}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.16em">FROM PROBLEM </text>
    <text x="214" y="108" fill="${GOLD}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.16em">TO </text>
    <text x="236" y="108" fill="${MUTED}" font-family="'Plus Jakarta Sans', system-ui, sans-serif" font-size="11" font-weight="600" letter-spacing="0.16em">SOLUTION</text>
  </g>
</svg>`;

function writePublic(name, content) {
  writeFileSync(resolve(publicDir, name), content, "utf8");
  console.log("  public/" + name);
}

function writeBrand(name, content) {
  writeFileSync(resolve(brandDir, name), content, "utf8");
  console.log("  brand/assets/" + name);
}

console.log("Writing SVG brand assets…");
writePublic("logo-dark.svg", horizontalLogo({ ink: NAVY, gold: GOLD, muted: MUTED, bg: SURFACE }));
writePublic("logo-light.svg", horizontalLogo({ ink: "#F7F8FA", gold: GOLD, muted: "#C8CED9", bg: NAVY }));
writePublic("icon-dark.svg", appIcon({ bg: NAVY, ink: "#F7F8FA" }));
writePublic("icon-light.svg", appIcon({ bg: SURFACE, ink: NAVY }));
writePublic("icon-maskable.svg", appIcon({ bg: NAVY, ink: "#F7F8FA" }));
writePublic("favicon.svg", favicon);
writePublic("og-image.svg", ogImage);

writeBrand("symbol.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" role="img" aria-label="Dalily mark"><g>${markGroup("currentColor")}</g></svg>`);
writeBrand("logo-horizontal.svg", horizontalLogo({ ink: NAVY, gold: GOLD, muted: MUTED, bg: SURFACE }));
writeBrand("logo-dark.svg", horizontalLogo({ ink: NAVY, gold: GOLD, muted: MUTED, bg: SURFACE }));
writeBrand("logo-light.svg", horizontalLogo({ ink: "#F7F8FA", gold: GOLD, muted: "#C8CED9", bg: NAVY }));
writeBrand("app-icon.svg", appIcon({ bg: NAVY, ink: "#F7F8FA" }));
writeBrand("favicon.svg", favicon);
console.log("Done.");
