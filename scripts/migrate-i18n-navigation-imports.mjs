/**
 * Migrate next-intl navigation imports off the routing barrel.
 * routing.ts must stay config-only (no createNavigation / Link re-exports).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

const NAV_SYMBOLS = new Set([
  "Link",
  "redirect",
  "usePathname",
  "useRouter",
  "getPathname",
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function splitImport(specifiers) {
  const parts = specifiers
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const nav = [];
  const routingOnly = [];
  for (const part of parts) {
    const base = part.replace(/\s+as\s+\w+$/, "").trim();
    if (NAV_SYMBOLS.has(base)) nav.push(part);
    else routingOnly.push(part);
  }
  return { nav, routingOnly };
}

let changed = 0;
for (const file of walk(srcRoot)) {
  if (file.includes(`${path.sep}lib${path.sep}i18n${path.sep}`)) continue;
  let text = fs.readFileSync(file, "utf8");
  const original = text;

  text = text.replace(
    /import\s*\{([^}]+)\}\s*from\s*["']@\/lib\/i18n\/routing["'];?/g,
    (match, specs) => {
      const { nav, routingOnly } = splitImport(specs);
      if (nav.length === 0) return match;
      const lines = [];
      if (routingOnly.length > 0) {
        lines.push(`import { ${routingOnly.join(", ")} } from "@/lib/i18n/routing";`);
      }
      lines.push(`import { ${nav.join(", ")} } from "@/lib/i18n/navigation";`);
      return lines.join("\n");
    },
  );

  if (text !== original) {
    fs.writeFileSync(file, text);
    changed += 1;
    console.log("updated", path.relative(root, file));
  }
}

console.log(`Done. Files updated: ${changed}`);
