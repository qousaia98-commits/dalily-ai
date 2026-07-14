/**
 * Export raster brand assets from approved SVG sources.
 * Run: npm run generate:brand
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const publicDir = resolve(process.cwd(), "public");

async function fromSvg(filename, outputs) {
  const svg = readFileSync(resolve(publicDir, filename));
  for (const { out, size, width, height } of outputs) {
    let pipeline = sharp(svg);
    if (size) pipeline = pipeline.resize(size, size);
    if (width && height) pipeline = pipeline.resize(width, height);
    await pipeline.png().toFile(resolve(publicDir, out));
    console.log(`  ${out}`);
  }
}

async function main() {
  console.log("Generating brand assets…");

  await fromSvg("icon-dark.svg", [
    { out: "android-192.png", size: 192 },
    { out: "android-512.png", size: 512 },
    { out: "apple-touch-icon.png", size: 180 },
  ]);

  await fromSvg("icon-maskable.svg", [{ out: "android-512-maskable.png", size: 512 }]);

  await fromSvg("icon-maskable.svg", [{ out: "android-512-maskable.png", size: 512 }]);

  await fromSvg("favicon.svg", [
    { out: "favicon-32.png", size: 32 },
    { out: "favicon-16.png", size: 16 },
    { out: "favicon-64.png", size: 64 },
    { out: "favicon-128.png", size: 128 },
    { out: "favicon-256.png", size: 256 },
  ]);

  await fromSvg("og-image.svg", [{ out: "og-image.png", width: 1200, height: 630 }]);

  const fav32 = await sharp(readFileSync(resolve(publicDir, "favicon-32.png"))).toBuffer();
  await sharp(fav32).resize(32, 32).toFormat("png").toFile(resolve(publicDir, "favicon.ico"));
  console.log("  favicon.ico");

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
