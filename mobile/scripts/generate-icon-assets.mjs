/**
 * Regenerate mobile app icon/splash assets from the same brand mark used by
 * the web app (public/icon-dark.svg) — real Dalily navy (#0B1526) + gold
 * (#C4A052), replacing the placeholder blue-chevron/guide-line PNGs.
 * Run: node scripts/generate-icon-assets.mjs
 */
import sharp from "sharp";
import { Buffer } from "node:buffer";
import { resolve } from "node:path";

const assetsDir = resolve(import.meta.dirname, "..", "assets");

const NAVY = "#0B1526";
const CREAM = "#F7F8FA";
const GOLD = "#C4A052";

// The mark alone (star + comet path + gold dot), no background — reused at
// different scales/paddings for each asset below.
function mark({ fill = CREAM, goldFill = GOLD, scale = 6, translate = [112, 112] } = {}) {
  return `<g transform="translate(${translate[0]}, ${translate[1]}) scale(${scale})">
    <path fill="${fill}" d="M9 15.5L10.4 19.6L14.5 21L10.4 22.4L9 26.5L7.6 22.4L3.5 21L7.6 19.6Z"/>
    <path fill="${fill}" d="M12.5 33C13.5 27 17 19 24 14.5C27 12.5 29.5 11.5 31.5 11L32.8 13.2C30.5 14 28 15.5 25.5 17.5C19 22.5 15 28.5 14 34.5Z"/>
    <circle cx="35.5" cy="8.5" r="3" fill="${goldFill}"/>
  </g>`;
}

async function svgToPng(svg, outPath, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log(`  ${outPath}`);
}

async function main() {
  console.log("Generating mobile icon/splash assets from Dalily brand mark…");

  // Main app icon (iOS masks its own corners) — navy square + mark.
  await svgToPng(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="${NAVY}"/>
      ${mark()}
    </svg>`,
    resolve(assetsDir, "icon.png"),
    1024,
  );

  // Splash — mark only, transparent, composited onto backgroundColor by Expo.
  await svgToPng(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      ${mark()}
    </svg>`,
    resolve(assetsDir, "splash-icon.png"),
    1024,
  );

  // Android adaptive icon foreground — mark only, transparent, scaled down
  // and centered so it stays inside the safe zone Android crops to.
  await svgToPng(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      ${mark({ scale: 4, translate: [156, 156] })}
    </svg>`,
    resolve(assetsDir, "android-icon-foreground.png"),
    512,
  );

  // Android adaptive icon background — solid navy, no mark.
  await svgToPng(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="${NAVY}"/>
    </svg>`,
    resolve(assetsDir, "android-icon-background.png"),
    512,
  );

  // Android monochrome (themed icon) — single-color mark, transparent bg.
  await svgToPng(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      ${mark({ fill: "#FFFFFF", goldFill: "#FFFFFF", scale: 4, translate: [156, 156] })}
    </svg>`,
    resolve(assetsDir, "android-icon-monochrome.png"),
    432,
  );

  // Favicon (web preview / Expo Go tab, minor) — same as icon.
  await svgToPng(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="${NAVY}"/>
      ${mark()}
    </svg>`,
    resolve(assetsDir, "favicon.png"),
    48,
  );

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
