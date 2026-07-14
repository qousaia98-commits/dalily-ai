/**
 * Verify registerBusinessSchema + category/city resolution (same path as registerBusinessAction).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

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

const CITY_IDS = {
  damascus: "b0000000-0000-4000-8000-000000000001",
  aleppo: "b0000000-0000-4000-8000-000000000002",
  homs: "b0000000-0000-4000-8000-000000000003",
  latakia: "b0000000-0000-4000-8000-000000000004",
};

const MODULE_SERVICES_ID = "a0000000-0000-4000-8000-000000000001";

const registerBusinessSchema = z
  .object({
    businessName: z.string().trim().min(2).max(120),
    category: z.string().trim().min(1).max(80),
    city: z.enum(Object.keys(CITY_IDS)),
    phone: z.string().trim().min(7).max(20),
    email: z.string().trim().email(),
    password: z.string().min(6).max(128),
    confirmPassword: z.string().min(6).max(128),
    about: z.string().trim().min(10).max(2000),
    services: z.string().trim().max(2000).optional(),
    locale: z.enum(["ar", "en"]).default("ar"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "password_mismatch",
    path: ["confirmPassword"],
  });

function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "_form",
    code: issue.code,
    message: issue.message,
  }));
}

const samplePayload = {
  businessName: "Test Business Co",
  category: "plumbing",
  city: "damascus",
  phone: "+963991234567",
  email: "test-business@example.com",
  password: "testpass123",
  confirmPassword: "testpass123",
  about: "We provide professional plumbing services across Damascus.",
  services: undefined,
  locale: "ar",
};

async function resolveCategorySlugToId(supabase, slug) {
  const { data } = await supabase
    .from("categories")
    .select("id, slug")
    .eq("module_id", MODULE_SERVICES_ID)
    .eq("depth", 1)
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("slug", slug)
    .maybeSingle();
  return data?.id ?? null;
}

async function main() {
  console.log("=== registerBusinessSchema (Zod) ===\n");

  const parsed = registerBusinessSchema.safeParse(samplePayload);
  if (!parsed.success) {
    console.log("Zod FAILED:");
    for (const issue of formatIssues(parsed.error)) {
      console.log(`  ${issue.field} -> ${issue.code}: ${issue.message}`);
    }
    process.exit(1);
  }
  console.log("Zod OK\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.log("No Supabase env — skipping DB category lookup");
    return;
  }

  const supabase = createClient(url, anonKey);
  const categoryId = await resolveCategorySlugToId(supabase, parsed.data.category);
  const cityId = CITY_IDS[parsed.data.city];

  console.log("=== Post-schema reference lookup ===\n");
  console.log("category slug:", parsed.data.category, "-> id:", categoryId ?? "MISSING");
  console.log("city slug:", parsed.data.city, "-> id:", cityId ?? "MISSING");

  if (!categoryId || !cityId) {
    console.log("\nvalidation_error source: reference lookup (NOT Zod)");
    if (!categoryId) console.log("  category -> not_found: slug not in active leaf categories");
    if (!cityId) console.log("  city -> not_found");
    process.exit(1);
  }

  const { data: leaves } = await supabase
    .from("categories")
    .select("slug")
    .eq("module_id", MODULE_SERVICES_ID)
    .eq("depth", 1)
    .eq("is_active", true)
    .is("deleted_at", null)
    .limit(5);

  console.log("\nSample active leaf slugs in DB:", (leaves ?? []).map((l) => l.slug).join(", "));
  console.log("\nAll checks passed for sample payload.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
