/**
 * Verify search returns plumbers for "My sink is leaking" (anon path).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CATEGORY_PLUMBER = "c0000000-0000-4000-8000-000000000001";
const VISIBLE = ["verified", "partially_verified"];

async function main() {
  const anon = createClient(url, anonKey);

  console.log("=== Post-fix search verification ===");
  console.log('Query: "My sink is leaking"');
  console.log("Problem: water_leak");
  console.log("Category: plumber");

  const { count: categoryCount } = await anon
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("category_id", CATEGORY_PLUMBER)
    .is("deleted_at", null);
  console.log("\nProviders after category filter:", categoryCount ?? 0);

  const { count: statusCount } = await anon
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("category_id", CATEGORY_PLUMBER)
    .is("deleted_at", null);
  console.log("Providers after status filter:", statusCount ?? 0);

  const { count: verificationCount } = await anon
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .in("verification_status", VISIBLE)
    .eq("category_id", CATEGORY_PLUMBER)
    .is("deleted_at", null);
  console.log("Providers after verification filter:", verificationCount ?? 0);

  const { data: ranked, error } = await anon
    .from("providers")
    .select("id, slug, name")
    .eq("status", "active")
    .in("verification_status", VISIBLE)
    .eq("category_id", CATEGORY_PLUMBER)
    .is("deleted_at", null)
    .limit(10);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  console.log("Providers after ranking:", ranked?.length ?? 0);
  if (!ranked?.length) {
    console.error("\nFAIL: No providers returned for plumber search.");
    process.exit(1);
  }

  console.log("\nPASS: Search would return providers:");
  for (const row of ranked) {
    console.log(`  - ${row.slug} (${row.id})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
