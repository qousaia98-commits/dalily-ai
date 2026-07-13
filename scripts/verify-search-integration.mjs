import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split("\n")) {
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing Supabase URL or anon key in .env.local");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const CATEGORY_PLUMBER = "c0000000-0000-4000-8000-000000000001";

async function main() {
  const { count, error } = await supabase
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("category_id", CATEGORY_PLUMBER)
    .is("deleted_at", null);

  if (error) {
    console.error("Integration check failed:", error.message);
    process.exit(1);
  }

  if (!count || count < 3) {
    console.error(`Expected at least 3 active plumbers, found ${count ?? 0}. Run npm run seed:search`);
    process.exit(1);
  }

  console.log(`Integration check passed: ${count} active plumbers available for search.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
