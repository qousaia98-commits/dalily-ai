/**
 * Permanent i18n validation for Dalily.
 *
 * Detects:
 * - Structure mismatch between messages/en.json and messages/ar.json
 * - Non-string leaf values (objects where strings are expected)
 * - Missing / orphan branches
 * - Duplicate keys within an object (JSON.parse cannot detect these —
 *   we still check sibling uniqueness after parse)
 * - Navigation labelKey resolution (mobile + sidebars)
 * - Critical header keys that must be strings (e.g. nav.admin)
 *
 * Usage:
 *   npm run validate:i18n
 *   npm run validate:i18n -- --unused   (optional unused-key scan, non-fatal by default)
 *
 * Exit 1 on critical errors.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EN_PATH = path.join(root, "messages", "en.json");
const AR_PATH = path.join(root, "messages", "ar.json");
const SRC_ROOT = path.join(root, "src");

const args = new Set(process.argv.slice(2));
const reportUnused = args.has("--unused");
const unusedFatal = args.has("--unused-fatal");

/** @typedef {{ severity: 'error' | 'warn'; code: string; message: string; path?: string }} Issue */

/** @type {Issue[]} */
const errors = [];
/** @type {Issue[]} */
const warnings = [];

function fail(code, message, p) {
  errors.push({ severity: "error", code, message, path: p });
}

function warn(code, message, p) {
  warnings.push({ severity: "warn", code, message, path: p });
}

function loadJson(filePath) {
  const raw = readFileSync(filePath, "utf8");
  detectDuplicateKeys(raw, path.relative(root, filePath));
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail("INVALID_JSON", `Cannot parse ${path.relative(root, filePath)}: ${e.message}`);
    return null;
  }
}

/**
 * Detect duplicate keys inside object literals.
 * JSON.parse silently keeps the last value — duplicates are otherwise invisible.
 */
function detectDuplicateKeys(raw, label) {
  /** @type {Array<{ keys: Map<string, number>, path: string[] }>} */
  const stack = [];
  let i = 0;
  let lastKey = null;

  while (i < raw.length) {
    const ch = raw[i];

    if (ch === '"') {
      let j = i + 1;
      let escaped = false;
      while (j < raw.length) {
        const c = raw[j];
        if (escaped) escaped = false;
        else if (c === "\\") escaped = true;
        else if (c === '"') break;
        j += 1;
      }
      const token = raw.slice(i + 1, j);
      let k = j + 1;
      while (k < raw.length && /\s/.test(raw[k])) k += 1;
      if (raw[k] === ":" && stack.length > 0) {
        const frame = stack[stack.length - 1];
        const prev = frame.keys.get(token);
        if (prev != null) {
          fail(
            "DUPLICATE_KEY",
            `Duplicate key "${token}" in ${label} (also seen earlier in same object)`,
            [...frame.path, token].join(".") || token,
          );
        }
        frame.keys.set(token, i);
        lastKey = token;
      } else {
        lastKey = null;
      }
      i = j + 1;
      continue;
    }

    if (ch === "{") {
      const parent = stack[stack.length - 1];
      const pathSegs = parent ? [...parent.path] : [];
      if (lastKey && parent) pathSegs.push(lastKey);
      stack.push({ keys: new Map(), path: pathSegs });
      lastKey = null;
      i += 1;
      continue;
    }

    if (ch === "}") {
      stack.pop();
      lastKey = null;
      i += 1;
      continue;
    }

    if (ch === "[" ) {
      // Arrays: skip until matching ] while still tracking nested objects via stack
      // (objects inside arrays are fine; keys reset per object)
      lastKey = null;
      i += 1;
      continue;
    }

    i += 1;
  }
}

/**
 * Walk tree collecting path → value kind.
 * @returns {Map<string, { kind: 'string'|'number'|'boolean'|'null'|'array'|'object'; value: unknown }>}
 */
function indexTree(node, prefix = "", out = new Map()) {
  if (node === null) {
    out.set(prefix, { kind: "null", value: null });
    return out;
  }
  const t = typeof node;
  if (t === "string" || t === "number" || t === "boolean") {
    out.set(prefix, { kind: t, value: node });
    return out;
  }
  if (Array.isArray(node)) {
    out.set(prefix, { kind: "array", value: node });
    node.forEach((item, i) => indexTree(item, `${prefix}[${i}]`, out));
    return out;
  }
  if (t === "object") {
    out.set(prefix || "(root)", { kind: "object", value: node });
    for (const key of Object.keys(node)) {
      const next = prefix ? `${prefix}.${key}` : key;
      indexTree(node[key], next, out);
    }
  }
  return out;
}

function getAt(obj, dotted) {
  if (!dotted || dotted === "(root)") return obj;
  const parts = dotted.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function resolveIsString(obj, dotted) {
  const v = getAt(obj, dotted);
  return typeof v === "string";
}

function validateStructure(en, ar) {
  const enIndex = indexTree(en);
  const arIndex = indexTree(ar);
  const enKeys = new Set([...enIndex.keys()].filter((k) => k !== "(root)"));
  const arKeys = new Set([...arIndex.keys()].filter((k) => k !== "(root)"));

  for (const key of enKeys) {
    if (!arKeys.has(key)) {
      fail("MISSING_IN_AR", `Key exists in en.json but missing in ar.json`, key);
    }
  }
  for (const key of arKeys) {
    if (!enKeys.has(key)) {
      fail("MISSING_IN_EN", `Key exists in ar.json but missing in en.json`, key);
    }
  }

  for (const key of enKeys) {
    if (!arKeys.has(key)) continue;
    const enNode = enIndex.get(key);
    const arNode = arIndex.get(key);
    if (enNode.kind !== arNode.kind) {
      fail(
        "KIND_MISMATCH",
        `Kind mismatch en=${enNode.kind} ar=${arNode.kind}`,
        key,
      );
    }
  }

  // Leaf values in message catalogs should be strings (ICU params stay in strings).
  for (const [key, meta] of enIndex) {
    if (key === "(root)") continue;
    if (meta.kind === "object" || meta.kind === "array") continue;
    if (meta.kind !== "string") {
      fail(
        "NON_STRING_LEAF",
        `Expected string leaf, found ${meta.kind}`,
        key,
      );
    }
  }
  for (const [key, meta] of arIndex) {
    if (key === "(root)") continue;
    if (meta.kind === "object" || meta.kind === "array") continue;
    if (meta.kind !== "string") {
      fail(
        "NON_STRING_LEAF",
        `Expected string leaf, found ${meta.kind}`,
        key,
      );
    }
  }
}

/** Keys that UI treats as strings (header / a11y). Must not be objects. */
const CRITICAL_STRING_PATHS = [
  "nav.search",
  "nav.forBusiness",
  "nav.dashboard",
  "nav.orders",
  "nav.admin",
  "nav.login",
  "nav.register",
  "nav.menu",
  "nav.openMenu",
  "nav.closeMenu",
  "mobileNav.a11y.label",
  "mobileNav.a11y.withBadge",
];

function validateCriticalStrings(en, ar) {
  for (const p of CRITICAL_STRING_PATHS) {
    for (const [locale, catalog] of [
      ["en", en],
      ["ar", ar],
    ]) {
      const v = getAt(catalog, p);
      if (v === undefined) {
        fail("MISSING_MESSAGE", `Missing critical key in ${locale}.json`, p);
        continue;
      }
      if (typeof v !== "string") {
        fail(
          "OBJECT_INSTEAD_OF_STRING",
          `Expected string in ${locale}.json, found ${typeof v === "object" ? "object" : typeof v}. ` +
            (typeof v === "object" && v && !Array.isArray(v)
              ? `Use a leaf under this path (e.g. ${p}.…) — this path itself must be a string.`
              : ""),
          p,
        );
      }
    }
  }
}

/**
 * Navigation labelKey registries — mirrors runtime namespaces.
 */
const NAV_LABEL_CHECKS = [
  {
    name: "mobileNav.guest",
    namespace: "mobileNav.guest",
    keys: ["home", "search", "orders", "messages", "account"],
  },
  {
    name: "mobileNav.business",
    namespace: "mobileNav.business",
    keys: [
      "dashboard",
      "newJobs",
      "orders",
      "messages",
      "account",
      "opportunities",
      "requests",
      "payments",
      "unlock",
    ],
  },
  {
    name: "mobileNav.admin",
    namespace: "mobileNav.admin",
    keys: [
      "controlCenter",
      "approvals",
      "payments",
      "issues",
      "admin",
      "messages",
      "marketplace",
    ],
  },
  {
    name: "business.nav",
    namespace: "business.nav",
    keys: [
      "title",
      "menu",
      "dashboard",
      "newJobs",
      "orders",
      "messages",
      "payments",
      "account",
    ],
  },
  {
    name: "admin.nav",
    namespace: "admin.nav",
    keys: [
      "title",
      "menu",
      "dashboard",
      "settings",
      "businesses",
      "customers",
      "verification",
      "payments",
      "issues",
      "messages",
      "unlockOps",
      "audit",
      "health",
      "categories",
      "analytics",
      "marketplace",
      "groups.people",
      "groups.operations",
      "groups.system",
      "groups.more",
    ],
  },
];

function validateNavLabels(en, ar) {
  for (const check of NAV_LABEL_CHECKS) {
    for (const key of check.keys) {
      const full = `${check.namespace}.${key}`;
      for (const [locale, catalog] of [
        ["en", en],
        ["ar", ar],
      ]) {
        const v = getAt(catalog, full);
        if (v === undefined) {
          fail(
            "MISSING_LABEL_KEY",
            `Navigation label missing in ${locale}.json (${check.name})`,
            full,
          );
          continue;
        }
        if (typeof v !== "string") {
          fail(
            "LABEL_NOT_STRING",
            `Navigation labelKey must resolve to a string in ${locale}.json (found ${typeof v})`,
            full,
          );
        }
      }
    }
  }
}

function walkSourceFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkSourceFiles(full, out);
    else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(name)) out.push(full);
  }
  return out;
}

/**
 * Extract static useTranslations / getTranslations namespaces and simple t("a.b") calls
 * in the same file (best-effort static analysis).
 */
function scanSourceUsages(en, ar) {
  const files = walkSourceFiles(SRC_ROOT);
  const nsPattern =
    /(?:useTranslations|getTranslations)\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g;
  const tCallPattern = /\bt\(\s*[`'"]([a-zA-Z0-9_.-]+)[`'"]/g;

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const namespaces = [...src.matchAll(nsPattern)].map((m) => m[1]);
    if (namespaces.length === 0) continue;

    // Validate namespaces themselves exist as objects (or allow leaf namespaces — rare)
    for (const ns of namespaces) {
      for (const [locale, catalog] of [
        ["en", en],
        ["ar", ar],
      ]) {
        const v = getAt(catalog, ns);
        if (v === undefined) {
          fail(
            "MISSING_NAMESPACE",
            `Translation namespace missing in ${locale}.json (used in ${path.relative(root, file)})`,
            ns,
          );
        }
      }
    }

    // For each t("relative.key"): resolve against file namespaces.
    // Multiple useTranslations() in one file is common — a key is OK if ANY
    // namespace resolves it to a string (avoids false positives like offerFlow.qa
    // vs offerFlow.customer).
    const relativeKeys = [...src.matchAll(tCallPattern)].map((m) => m[1]);
    for (const rel of relativeKeys) {
      if (!rel || rel.includes("${")) continue;

      const stringHits = [];
      const objectHits = [];
      const missingHits = [];

      for (const ns of namespaces) {
        const full = `${ns}.${rel}`;
        const enV = getAt(en, full);
        const arV = getAt(ar, full);
        if (typeof enV === "string" && typeof arV === "string") {
          stringHits.push(full);
        } else if (enV !== undefined || arV !== undefined) {
          const sample = enV !== undefined ? enV : arV;
          if (sample !== null && typeof sample === "object") {
            objectHits.push({
              full,
              keys:
                sample && !Array.isArray(sample)
                  ? Object.keys(sample).slice(0, 5)
                  : [],
            });
          } else if (enV === undefined || arV === undefined) {
            missingHits.push(full);
          } else {
            fail(
              "NON_STRING_LEAF",
              `t("${rel}") under "${ns}" is ${typeof sample} (file ${path.relative(root, file)})`,
              full,
            );
          }
        }
      }

      if (stringHits.length > 0) continue;

      if (objectHits.length > 0) {
        const hit = objectHits[0];
        const suggestion =
          hit.keys.length > 0
            ? `Use: ${hit.keys.map((k) => `${rel}.${k}`).join(" | ")} instead.`
            : "Use a deeper leaf key that resolves to a string.";
        fail(
          "INSUFFICIENT_PATH",
          `t("${rel}") resolves to object (file ${path.relative(root, file)}).\n` +
            `  Expected: string\n  Found: object\n  ${suggestion}`,
          hit.full,
        );
        continue;
      }

      if (missingHits.length > 0) {
        fail(
          "MISSING_MESSAGE",
          `t("${rel}") missing under declared namespace(s) in ${path.relative(root, file)}.\n` +
            `  Expected: string\n  Found: undefined`,
          missingHits[0],
        );
      }
    }
  }
}

function collectStringLeaves(node, prefix = "", out = []) {
  if (typeof node === "string") {
    out.push(prefix);
    return out;
  }
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const k of Object.keys(node)) {
      collectStringLeaves(node[k], prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

function scanUnusedKeys(en) {
  if (!reportUnused) return;
  const files = walkSourceFiles(SRC_ROOT);
  const corpus = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const leaves = collectStringLeaves(en);
  let unused = 0;
  for (const leaf of leaves) {
    const short = leaf.split(".").pop() ?? leaf;
    // Heuristic: key path or last segment appears in source
    if (corpus.includes(leaf) || corpus.includes(`"${short}"`) || corpus.includes(`'${short}'`)) {
      continue;
    }
    unused += 1;
    warn("UNUSED_KEY", "No static reference found in src/ (heuristic)", leaf);
  }
  if (unusedFatal && unused > 0) {
    fail("UNUSED_KEYS_FATAL", `${unused} potentially unused keys (--unused-fatal)`);
  }
}

function printReport() {
  console.log("\n══ Dalily i18n validation ══\n");

  if (errors.length === 0 && warnings.length === 0) {
    console.log("✓ All translation checks passed.\n");
    return;
  }

  for (const issue of errors) {
    console.log("--------------------------------");
    console.log(`Missing / invalid translation:`);
    console.log(`  ${issue.path ?? "(unknown path)"}`);
    console.log(`Code: ${issue.code}`);
    console.log(issue.message);
    console.log("");
  }
  for (const issue of warnings) {
    console.log(`⚠ [${issue.code}] ${issue.path ?? ""}`);
    console.log(`  ${issue.message}\n`);
  }

  console.log("--------------------------------");
  console.log(
    `Summary: ${errors.length} error(s), ${warnings.length} warning(s).\n`,
  );
}

function main() {
  const en = loadJson(EN_PATH);
  const ar = loadJson(AR_PATH);
  if (!en || !ar) {
    printReport();
    process.exit(1);
  }

  validateStructure(en, ar);
  validateCriticalStrings(en, ar);
  validateNavLabels(en, ar);
  scanSourceUsages(en, ar);
  scanUnusedKeys(en);

  printReport();
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
