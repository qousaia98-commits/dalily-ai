/**
 * Verify post-signUp bootstrap for user + business, with/without session.
 * Mirrors bootstrapUserAfterSignUp + business provider insert.
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MODULE_SERVICES_ID = "a0000000-0000-4000-8000-000000000001";
const CITY_ID = "b0000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "c0000000-0000-4000-8000-000000000001";

function slug(name, userId) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = userId.replace(/-/g, "").slice(0, 8);
  return base.length >= 2 ? `${base}-${suffix}` : `business-${suffix}`;
}

async function bootstrapUser(admin, { userId, email, displayName, role, locale, hasSession }) {
  const emailVerifiedAt = hasSession ? new Date().toISOString() : null;

  const { error: userError } = await admin.from("users").insert({
    id: userId,
    email,
    preferred_locale: locale,
    email_verified_at: emailVerifiedAt,
  });
  if (userError) throw new Error(`users: ${userError.message}`);

  const { error: profileError } = await admin.from("profiles").insert({
    user_id: userId,
    display_name: displayName,
  });
  if (profileError) throw new Error(`profiles: ${profileError.message}`);

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: userId,
    role,
  });
  if (roleError) throw new Error(`user_roles: ${roleError.message}`);

  const { data: userRow } = await admin
    .from("users")
    .select("email_verified_at")
    .eq("id", userId)
    .single();

  const verifiedOk = hasSession ? Boolean(userRow?.email_verified_at) : !userRow?.email_verified_at;
  if (!verifiedOk) {
    throw new Error(`email_verified_at mismatch (hasSession=${hasSession})`);
  }
}

async function bootstrapBusiness(admin, params) {
  await bootstrapUser(admin, params);
  const { userId, email, displayName } = params;

  const { data: provider, error } = await admin
    .from("providers")
    .insert({
      owner_id: userId,
      slug: slug(displayName, userId),
      name: { ar: displayName, en: displayName },
      about: { ar: "About long enough", en: "About long enough" },
      module_id: MODULE_SERVICES_ID,
      category_id: CATEGORY_ID,
      city_id: CITY_ID,
      phone: "+963911234567",
      whatsapp: "+963911234567",
      email,
      status: "draft",
      verification_status: "unverified",
      profile_completeness: 40,
      created_by: userId,
      updated_by: userId,
      metadata: { services_text: "test" },
    })
    .select("id")
    .single();

  if (error) throw new Error(`providers: ${error.message}`);
  return provider.id;
}

async function cleanup(admin, userId, providerId) {
  if (providerId) await admin.from("providers").delete().eq("id", providerId);
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("profiles").delete().eq("user_id", userId);
  await admin.from("users").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}

async function runCase(label, fn) {
  try {
    await fn();
    console.log(`PASS  ${label}`);
  } catch (e) {
    console.error(`FAIL  ${label}:`, e.message);
    process.exitCode = 1;
  }
}

async function main() {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const cases = [
    ["user registration — email confirmation enabled (no session)", false, "user"],
    ["user registration — email confirmation disabled (session)", true, "user"],
    ["business registration — email confirmation enabled (no session)", false, "business"],
    ["business registration — email confirmation disabled (session)", true, "business"],
  ];

  for (const [label, hasSession, kind] of cases) {
    await runCase(label, async () => {
      const suffix = randomBytes(4).toString("hex");
      const email = `signup.${kind}.${suffix}@gmail.com`;
      const displayName = kind === "business" ? `Biz ${suffix}` : `User ${suffix}`;

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: "testpass123",
        email_confirm: hasSession,
      });
      if (error || !created.user) throw new Error(error?.message ?? "createUser failed");

      const userId = created.user.id;
      let providerId = null;

      try {
        const params = {
          userId,
          email,
          displayName,
          role: kind,
          locale: "en",
          hasSession,
        };

        if (kind === "business") {
          providerId = await bootstrapBusiness(admin, params);
        } else {
          await bootstrapUser(admin, params);
        }
      } finally {
        await cleanup(admin, userId, providerId);
      }
    });
  }

  if (process.exitCode) {
    console.error("\nSome signup bootstrap tests failed.");
    process.exit(1);
  }

  console.log("\nAll signup bootstrap tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
