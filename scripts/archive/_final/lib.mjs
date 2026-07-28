import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export const SHOTS_DIR =
  "C:\\Users\\QUSAYA~1\\AppData\\Local\\Temp\\claude\\c--Users-Qusay-Abbasi-Desktop-Daliliy-Ai\\f33f7bf4-058c-4f74-8d69-4faa8f2922ac\\scratchpad\\final-shots";
mkdirSync(SHOTS_DIR, { recursive: true });

export const BASE_URL = "http://localhost:3000";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile(resolve(process.cwd(), ".env.local"));

export function adminDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let shotCounter = 0;
export async function shot(page, name) {
  shotCounter += 1;
  const file = resolve(SHOTS_DIR, `${String(shotCounter).padStart(3, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch((e) => log("SCREENSHOT_FAIL", name, e.message));
  return file;
}

export function log(...args) {
  console.log(new Date().toISOString().slice(11, 19), ...args);
}

export async function newSession(label, viewport = { width: 1400, height: 900 }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport, locale: "en-US" });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  const issues = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      issues.push({ kind: "console.error", text: msg.text(), url: page.url() });
      log(`[${label}] CONSOLE ERROR:`, msg.text().slice(0, 300));
    }
    if (msg.type() === "warning" && /hydrat/i.test(msg.text())) {
      issues.push({ kind: "console.warning", text: msg.text(), url: page.url() });
      log(`[${label}] HYDRATION WARNING:`, msg.text().slice(0, 300));
    }
  });
  page.on("pageerror", (err) => {
    issues.push({ kind: "pageerror", text: err.message, url: page.url() });
    log(`[${label}] PAGE ERROR:`, err.message.slice(0, 300));
  });
  page.on("requestfailed", (req) => {
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    issues.push({ kind: "requestfailed", text: `${req.method()} ${req.url()} :: ${req.failure()?.errorText}`, url: page.url() });
    log(`[${label}] REQUEST FAILED:`, req.method(), req.url(), req.failure()?.errorText);
  });
  page.on("response", (res) => {
    if (res.status() >= 500) {
      issues.push({ kind: "http5xx", text: `${res.status()} ${res.url()}`, url: page.url() });
      log(`[${label}] HTTP 5xx:`, res.status(), res.url());
    }
  });
  return { browser, context, page, issues };
}

export async function closeSession(session) {
  await session.browser.close();
}

export async function dismissModal(page, waitMs = 2500) {
  const deadline = Date.now() + waitMs;
  let dismissed = false;
  while (Date.now() < deadline) {
    const chooseCity = page.getByRole("button", { name: /choose city instead|اختر مدينة بدلاً/i }).first();
    const visible = await chooseCity.isVisible().catch(() => false);
    if (visible) {
      await chooseCity.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(300);
      dismissed = true;
    } else if (dismissed) {
      break;
    }
    await page.waitForTimeout(250);
  }
  return dismissed;
}

export async function warmup(paths) {
  for (const p of paths) {
    try {
      await fetch(`${BASE_URL}${p}`, { redirect: "manual" });
    } catch (e) {
      log("WARMUP_FAIL", p, e.message);
    }
  }
}

export function hydrationIssues(issues) {
  return issues.filter((i) => /hydration/i.test(i.text));
}
