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

if (!url || !anonKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

const SEED_PROVIDER_ID = "e0000000-0000-4000-8000-000000000001";

async function main() {
  const failures = [];

  const { data: provider, error } = await supabase
    .from("providers")
    .select("id, status, name")
    .eq("id", SEED_PROVIDER_ID)
    .eq("status", "active")
    .maybeSingle();

  if (error || !provider) {
    failures.push("Active seed provider not found for profile integration");
  }

  const { count } = await supabase
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .is("deleted_at", null);

  if (!count || count < 3) {
    failures.push(`Expected at least 3 active providers for featured section, found ${count ?? 0}`);
  }

  if (failures.length > 0) {
    console.error("Beta critical verification failed:");
    for (const failure of failures) failures.forEach((item) => console.error(`  - ${item}`));
    process.exit(1);
  }

  console.log("Beta critical DB checks passed:");
  console.log(`  - Public profile source provider: ${provider?.id}`);
  console.log(`  - Active providers for featured/search: ${count}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
