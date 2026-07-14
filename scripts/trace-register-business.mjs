/**
 * Trace registerBusinessAction steps against live Supabase — stops at first failure.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

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

if (!url || !anonKey || !serviceKey) {
  console.error("Missing env");
  process.exit(1);
}

const MODULE_SERVICES_ID = "a0000000-0000-4000-8000-000000000001";
const CITY_IDS = { damascus: "b0000000-0000-4000-8000-000000000001" };

function localizedName(text) {
  return { ar: text, en: text };
}

function generateProviderSlug(businessName, userId) {
  const latinSlug = businessName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = userId.replace(/-/g, "").slice(0, 8);
  return latinSlug.length >= 2 ? `${latinSlug}-${suffix}` : `business-${suffix}`;
}

function logOk(step) {
  console.log(`✓ ${step}`);
}

function logFail(step, error) {
  console.error(`✗ ${step} FAILED`);
  console.error("  message:", error.message);
  console.error("  code:", error.code);
  console.error("  details:", error.details);
  console.error("  hint:", error.hint);
}

async function resolveCategorySlugToId(admin, slug) {
  const { data, error } = await admin
    .from("categories")
    .select("id, slug")
    .eq("module_id", MODULE_SERVICES_ID)
    .eq("depth", 1)
    .eq("is_active", true)
    .is("deleted_at", null)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function main() {
  const suffix = randomBytes(4).toString("hex");
  const email = `biztrace${suffix}@gmail.com`;
  const password = "testpass123";
  const businessName = `Trace Business ${suffix}`;
  const categorySlug = "plumbing";
  const citySlug = "damascus";
  const phone = "+963991234567";
  const about = "Professional plumbing services across Damascus and nearby areas.";

  console.log("=== registerBusinessAction trace ===\n");

  const anon = createClient(url, anonKey);
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // schema + lookup (already passed for user)
  const categoryId = await resolveCategorySlugToId(admin, categorySlug);
  const cityId = CITY_IDS[citySlug];
  if (!categoryId || !cityId) {
    console.error("✗ category/city lookup FAILED", { categoryId, cityId, categorySlug });
    process.exit(1);
  }
  logOk("schema validation");
  logOk("category/city lookup");

  const { data: signUpData, error: signUpError } = await anon.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: businessName, role: "business" },
    },
  });

  if (signUpError) {
    logFail("signUp", signUpError);
    process.exit(1);
  }
  if (!signUpData.user) {
    console.error("✗ signUp FAILED: no user returned");
    process.exit(1);
  }
  logOk("signUp");

  const userId = signUpData.user.id;
  const hasSession = Boolean(signUpData.session);

  const { error: userError } = await admin.from("users").insert({
    id: userId,
    email,
    preferred_locale: "ar",
    email_verified_at: hasSession ? new Date().toISOString() : null,
  });
  if (userError) {
    logFail("create user", userError);
    process.exit(1);
  }
  logOk("create user");

  const { error: profileError } = await admin.from("profiles").insert({
    user_id: userId,
    display_name: businessName,
  });
  if (profileError) {
    logFail("create profile", profileError);
    process.exit(1);
  }
  logOk("create profile");

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: userId,
    role: "business",
  });
  if (roleError) {
    logFail("create role", roleError);
    process.exit(1);
  }
  logOk("create role");

  const slug = generateProviderSlug(businessName, userId);
  const { data: provider, error: providerError } = await admin
    .from("providers")
    .insert({
      owner_id: userId,
      slug,
      name: localizedName(businessName),
      about: localizedName(about),
      module_id: MODULE_SERVICES_ID,
      category_id: categoryId,
      city_id: cityId,
      phone,
      whatsapp: phone,
      email,
      status: "draft",
      verification_status: "unverified",
      profile_completeness: 40,
      created_by: userId,
      updated_by: userId,
      metadata: { services_text: "" },
    })
    .select("id")
    .single();

  if (providerError) {
    logFail("create provider", providerError);
    process.exit(1);
  }
  logOk("create provider");

  // Not in registerBusinessAction — informational only
  const { data: freePlan } = await admin
    .from("subscription_plans")
    .select("id")
    .eq("slug", "free")
    .maybeSingle();

  if (freePlan) {
    const { error: subError } = await admin.from("subscriptions").insert({
      provider_id: provider.id,
      plan_id: freePlan.id,
      status: "active",
      auto_renew: true,
    });
    if (subError) {
      logFail("create subscription (optional — not in registerBusinessAction)", subError);
    } else {
      logOk("create subscription (optional)");
      await admin.from("subscriptions").delete().eq("provider_id", provider.id);
    }
  } else {
    console.log("— create subscription skipped (not in registerBusinessAction, no free plan)");
  }

  const { error: verError } = await admin.from("provider_verifications").insert({
    provider_id: provider.id,
    status: "pending",
    submitted_at: new Date().toISOString(),
  });
  if (verError) {
    console.log("— create verification skipped/failed (not in registerBusinessAction):", verError.message);
  } else {
    logOk("create verification (optional — not in registerBusinessAction)");
    await admin.from("provider_verifications").delete().eq("provider_id", provider.id);
  }

  // cleanup
  await admin.from("providers").delete().eq("id", provider.id);
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("user_id", userId);
  await admin.from("users").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);

  logOk("success");
  console.log("\nAll registerBusinessAction steps passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
