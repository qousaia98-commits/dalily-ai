/**
 * Trace search pipeline for "My sink is leaking".
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const QUERY = "My sink is leaking";
const CATEGORY_PLUMBER = "c0000000-0000-4000-8000-000000000001";

async function main() {
  const problem = "water_leak";
  const category = "plumber";

  console.log("=== Search pipeline trace ===");
  console.log("Query:", QUERY);
  console.log("Problem:", problem);
  console.log("Category:", category);

  const anon = createClient(url, anonKey);
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: categoryCount } = await admin
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("category_id", CATEGORY_PLUMBER)
    .is("deleted_at", null);

  console.log("\nProviders after category filter (all statuses):", categoryCount ?? 0);

  const { count: statusCount } = await admin
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("category_id", CATEGORY_PLUMBER)
    .is("deleted_at", null);

  console.log("Providers after status filter (active + plumber):", statusCount ?? 0);

  const { data: approvedAnon, error: approvedAnonErr } = await anon
    .from("provider_verifications")
    .select("provider_id")
    .eq("status", "approved");

  console.log("\nApproved verifications readable via anon:", approvedAnon?.length ?? 0);
  if (approvedAnonErr) console.log("  error:", approvedAnonErr.message, approvedAnonErr.code);

  const { data: approvedAdmin } = await admin
    .from("provider_verifications")
    .select("provider_id")
    .eq("status", "approved");

  console.log("Approved verifications (admin):", approvedAdmin?.length ?? 0);

  const anonApprovedIds = new Set((approvedAnon ?? []).map((r) => r.provider_id));
  if (anonApprovedIds.size === 0) {
    console.log("Providers after verification filter (search path / anon): 0");
  } else {
    const { count } = await anon
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .eq("category_id", CATEGORY_PLUMBER)
      .is("deleted_at", null)
      .in("id", [...anonApprovedIds]);
    console.log("Providers after verification filter (search path / anon):", count ?? 0);
  }

  const adminApprovedIds = new Set((approvedAdmin ?? []).map((r) => r.provider_id));
  const { count: finalAdmin } = await admin
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .eq("category_id", CATEGORY_PLUMBER)
    .is("deleted_at", null)
    .in("id", [...adminApprovedIds]);

  console.log("Providers after verification filter (admin approved ids):", finalAdmin ?? 0);
  console.log("Providers after ranking: (same set, ranking does not drop rows)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
