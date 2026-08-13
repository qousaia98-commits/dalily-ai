/**
 * Reproduce registerBusinessAction against live Supabase — logs exact DB errors.
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
const CATEGORY_IDS = { plumber: "c0000000-0000-4000-8000-000000000001" };

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

async function main() {
  const suffix = randomBytes(4).toString("hex");
  const email = `biztest${suffix}@gmail.com`;
  const password = "testpass123";
  const businessName = `Test Business ${suffix}`;

  console.log("=== Reproducing registerBusinessAction (DB steps) ===");
  console.log("Email:", email);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: createdAuth, error: createAuthError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: businessName, role: "business" },
  });

  if (createAuthError || !createdAuth.user) {
    console.error("STEP admin.createUser FAILED:", createAuthError?.message, createAuthError);
    process.exit(1);
  }

  const userId = createdAuth.user.id;
  const hasSession = false; // simulates email-confirm flow (no session at signup)
  console.log("createUser OK — userId:", userId, "hasSession:", hasSession);

  const dbClient = admin;

  // createUserRecords
  const { error: userError } = await dbClient.from("users").insert({
    id: userId,
    email,
    preferred_locale: "en",
    email_verified_at: hasSession ? new Date().toISOString() : null,
  });

  if (userError) {
    console.error("STEP users.insert FAILED:", userError.message);
    console.error("  code:", userError.code, "details:", userError.details, "hint:", userError.hint);
    process.exit(1);
  }
  console.log("users.insert OK");

  const { error: profileError } = await dbClient.from("profiles").insert({
    user_id: userId,
    display_name: businessName,
  });

  if (profileError) {
    console.error("STEP profiles.insert FAILED:", profileError.message);
    console.error("  code:", profileError.code, "details:", profileError.details);
    process.exit(1);
  }
  console.log("profiles.insert OK");

  const { error: roleError } = await dbClient.from("user_roles").insert({
    user_id: userId,
    role: "business",
  });

  if (roleError) {
    console.error("STEP user_roles.insert FAILED:", roleError.message);
    console.error("  code:", roleError.code, "details:", roleError.details);
    process.exit(1);
  }
  console.log("user_roles.insert OK");

  const slug = generateProviderSlug(businessName, userId);

  const { data: provider, error: providerError } = await admin.from("providers").insert({
    owner_id: userId,
    slug,
    name: { ar: businessName, en: businessName },
    about: { ar: "About text long enough", en: "About text long enough" },
    module_id: MODULE_SERVICES_ID,
    category_id: CATEGORY_IDS.plumber,
    city_id: CITY_IDS.damascus,
    phone: "+963911234567",
    whatsapp: "+963911234567",
    email,
    status: "draft",
    verification_status: "unverified",
    profile_completeness: 40,
    created_by: userId,
    updated_by: userId,
    metadata: { services_text: "plumbing" },
  }).select("id").single();

  if (providerError) {
    console.error("STEP providers.insert FAILED:", providerError.message);
    console.error("  code:", providerError.code, "details:", providerError.details, "hint:", providerError.hint);
    process.exit(1);
  }
  console.log("providers.insert OK — providerId:", provider?.id);

  // Test ensureFreeSubscription (added in Sprint 7 to createProviderAction only)
  const { data: freePlan } = await admin
    .from("subscription_plans")
    .select("id")
    .eq("slug", "free")
    .maybeSingle();

  if (!freePlan) {
    console.error("STEP subscription_plans: free plan NOT FOUND (migration not applied?)");
  } else {
    const { error: subError } = await admin.from("subscriptions").insert({
      provider_id: provider.id,
      plan_id: freePlan.id,
      status: "active",
      auto_renew: true,
    });
    if (subError) {
      console.error("STEP subscriptions.insert FAILED:", subError.message);
      console.error("  code:", subError.code, "details:", subError.details);
    } else {
      console.log("subscriptions.insert OK");
    }
  }

  // Cleanup
  await admin.from("subscriptions").delete().eq("provider_id", provider.id);
  await admin.from("providers").delete().eq("id", provider.id);
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("user_id", userId);
  await admin.from("users").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);

  console.log("\n=== All steps passed (cleaned up test user) ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
