import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const MODULE_SERVICES_ID = "a0000000-0000-4000-8000-000000000001";

const CITY_IDS = {
  damascus: "b0000000-0000-4000-8000-000000000001",
  aleppo: "b0000000-0000-4000-8000-000000000002",
};

const CATEGORY_IDS = {
  plumber: "c0000000-0000-4000-8000-000000000001",
  electrician: "c0000000-0000-4000-8000-000000000002",
  mechanic: "c0000000-0000-4000-8000-000000000005",
};

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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_PASSWORD = "DalilySeed2026!";

/** @type {Array<{ ownerId: string, email: string, displayName: string }>} */
const OWNERS = [
  { ownerId: "d0000000-0000-4000-8000-000000000001", email: "seed-plumber-1@dalily.local", displayName: "Seed Plumber 1" },
  { ownerId: "d0000000-0000-4000-8000-000000000002", email: "seed-plumber-2@dalily.local", displayName: "Seed Plumber 2" },
  { ownerId: "d0000000-0000-4000-8000-000000000003", email: "seed-plumber-3@dalily.local", displayName: "Seed Plumber 3" },
  { ownerId: "d0000000-0000-4000-8000-000000000004", email: "seed-plumber-4@dalily.local", displayName: "Seed Plumber 4" },
  { ownerId: "d0000000-0000-4000-8000-000000000005", email: "seed-electric-1@dalily.local", displayName: "Seed Electric 1" },
  { ownerId: "d0000000-0000-4000-8000-000000000006", email: "seed-electric-2@dalily.local", displayName: "Seed Electric 2" },
  { ownerId: "d0000000-0000-4000-8000-000000000007", email: "seed-electric-3@dalily.local", displayName: "Seed Electric 3" },
  { ownerId: "d0000000-0000-4000-8000-000000000008", email: "seed-electric-4@dalily.local", displayName: "Seed Electric 4" },
  { ownerId: "d0000000-0000-4000-8000-000000000009", email: "seed-mechanic-1@dalily.local", displayName: "Seed Mechanic 1" },
  { ownerId: "d0000000-0000-4000-8000-00000000000a", email: "seed-mechanic-2@dalily.local", displayName: "Seed Mechanic 2" },
  { ownerId: "d0000000-0000-4000-8000-00000000000b", email: "seed-mechanic-3@dalily.local", displayName: "Seed Mechanic 3" },
  { ownerId: "d0000000-0000-4000-8000-00000000000c", email: "seed-mechanic-4@dalily.local", displayName: "Seed Mechanic 4" },
];

/** @type {Array<Record<string, unknown>>} */
const PROVIDERS = [
  {
    id: "e0000000-0000-4000-8000-000000000001",
    ownerId: "d0000000-0000-4000-8000-000000000001",
    slug: "al-sham-plumbing",
    name: { ar: "سباكة الشام", en: "Al-Sham Plumbing" },
    about: { ar: "إصلاح تسريبات الطوارئ في دمشق", en: "Emergency leak repair in Damascus" },
    category_id: CATEGORY_IDS.plumber,
    city_id: CITY_IDS.damascus,
    verification_status: "verified",
    trust_score: 96,
    rating_avg: 4.9,
    review_count: 128,
    profile_completeness: 95,
    response_time_hours: 2,
  },
  {
    id: "e0000000-0000-4000-8000-000000000002",
    ownerId: "d0000000-0000-4000-8000-000000000002",
    slug: "fast-fix-plumbing",
    name: { ar: "إصلاح سريع للسباكة", en: "Fast Fix Plumbing" },
    about: { ar: "سباكة منزلية سريعة", en: "Fast residential plumbing" },
    category_id: CATEGORY_IDS.plumber,
    city_id: CITY_IDS.damascus,
    verification_status: "verified",
    trust_score: 91,
    rating_avg: 4.7,
    review_count: 86,
    profile_completeness: 88,
    response_time_hours: 3,
  },
  {
    id: "e0000000-0000-4000-8000-000000000003",
    ownerId: "d0000000-0000-4000-8000-000000000003",
    slug: "damascus-pipes-co",
    name: { ar: "شركة مواسير دمشق", en: "Damascus Pipes Co" },
    about: { ar: "تركيب وصيانة المواسير", en: "Pipe installation and maintenance" },
    category_id: CATEGORY_IDS.plumber,
    city_id: CITY_IDS.damascus,
    verification_status: "partially_verified",
    trust_score: 84,
    rating_avg: 4.5,
    review_count: 54,
    profile_completeness: 80,
    response_time_hours: 5,
  },
  {
    id: "e0000000-0000-4000-8000-000000000004",
    ownerId: "d0000000-0000-4000-8000-000000000004",
    slug: "budget-plumber-damascus",
    name: { ar: "سباك اقتصادي", en: "Budget Plumber Damascus" },
    about: { ar: "خدمات سباكة بأسعار مناسبة", en: "Affordable plumbing services" },
    category_id: CATEGORY_IDS.plumber,
    city_id: CITY_IDS.damascus,
    verification_status: "unverified",
    trust_score: 68,
    rating_avg: 4.0,
    review_count: 22,
    profile_completeness: 62,
    response_time_hours: 8,
  },
  {
    id: "e0000000-0000-4000-8000-000000000005",
    ownerId: "d0000000-0000-4000-8000-000000000005",
    slug: "syria-power-repair",
    name: { ar: "كهرباء سوريا", en: "Syria Power Repair" },
    about: { ar: "إصلاح انقطاع التيار", en: "Power outage and wiring repair" },
    category_id: CATEGORY_IDS.electrician,
    city_id: CITY_IDS.damascus,
    verification_status: "verified",
    trust_score: 94,
    rating_avg: 4.8,
    review_count: 102,
    profile_completeness: 92,
    response_time_hours: 2,
  },
  {
    id: "e0000000-0000-4000-8000-000000000006",
    ownerId: "d0000000-0000-4000-8000-000000000006",
    slug: "bright-spark-electric",
    name: { ar: "شرارة مشرقة", en: "Bright Spark Electric" },
    about: { ar: "كهربائي منازل ومحلات", en: "Home and shop electrician" },
    category_id: CATEGORY_IDS.electrician,
    city_id: CITY_IDS.damascus,
    verification_status: "verified",
    trust_score: 88,
    rating_avg: 4.6,
    review_count: 71,
    profile_completeness: 85,
    response_time_hours: 4,
  },
  {
    id: "e0000000-0000-4000-8000-000000000007",
    ownerId: "d0000000-0000-4000-8000-000000000007",
    slug: "city-electric-aleppo",
    name: { ar: "كهرباء المدينة حلب", en: "City Electric Aleppo" },
    about: { ar: "خدمات كهربائية في حلب", en: "Electrical services in Aleppo" },
    category_id: CATEGORY_IDS.electrician,
    city_id: CITY_IDS.aleppo,
    verification_status: "partially_verified",
    trust_score: 81,
    rating_avg: 4.4,
    review_count: 48,
    profile_completeness: 78,
    response_time_hours: 6,
  },
  {
    id: "e0000000-0000-4000-8000-000000000008",
    ownerId: "d0000000-0000-4000-8000-000000000008",
    slug: "quick-wire-services",
    name: { ar: "أسلاك سريعة", en: "Quick Wire Services" },
    about: { ar: "صيانة كهربائية سريعة", en: "Quick electrical maintenance" },
    category_id: CATEGORY_IDS.electrician,
    city_id: CITY_IDS.damascus,
    verification_status: "unverified",
    trust_score: 70,
    rating_avg: 3.9,
    review_count: 19,
    profile_completeness: 60,
    response_time_hours: 10,
  },
  {
    id: "e0000000-0000-4000-8000-000000000009",
    ownerId: "d0000000-0000-4000-8000-000000000009",
    slug: "cool-air-hvac",
    name: { ar: "هواء بارد", en: "Cool Air HVAC" },
    about: { ar: "صيانة مكيفات وتبريد", en: "AC repair and cooling services" },
    category_id: CATEGORY_IDS.mechanic,
    city_id: CITY_IDS.damascus,
    verification_status: "verified",
    trust_score: 93,
    rating_avg: 4.8,
    review_count: 95,
    profile_completeness: 90,
    response_time_hours: 3,
  },
  {
    id: "e0000000-0000-4000-8000-00000000000a",
    ownerId: "d0000000-0000-4000-8000-00000000000a",
    slug: "frost-fix-ac",
    name: { ar: "إصلاح الصقيع", en: "Frost Fix AC" },
    about: { ar: "إصلاح مكيفات منزلية", en: "Residential AC repair" },
    category_id: CATEGORY_IDS.mechanic,
    city_id: CITY_IDS.damascus,
    verification_status: "verified",
    trust_score: 87,
    rating_avg: 4.5,
    review_count: 63,
    profile_completeness: 82,
    response_time_hours: 5,
  },
  {
    id: "e0000000-0000-4000-8000-00000000000b",
    ownerId: "d0000000-0000-4000-8000-00000000000b",
    slug: "home-appliance-care",
    name: { ar: "عناية بالأجهزة", en: "Home Appliance Care" },
    about: { ar: "إصلاح غسالات وأجهزة منزلية", en: "Washing machine and appliance repair" },
    category_id: CATEGORY_IDS.mechanic,
    city_id: CITY_IDS.damascus,
    verification_status: "partially_verified",
    trust_score: 79,
    rating_avg: 4.3,
    review_count: 41,
    profile_completeness: 76,
    response_time_hours: 6,
  },
  {
    id: "e0000000-0000-4000-8000-00000000000c",
    ownerId: "d0000000-0000-4000-8000-00000000000c",
    slug: "locksmith-damascus",
    name: { ar: "قفال دمشق", en: "Damascus Locksmith" },
    about: { ar: "فتح أقفال الطوارئ", en: "Emergency lockout services" },
    category_id: CATEGORY_IDS.mechanic,
    city_id: CITY_IDS.damascus,
    verification_status: "verified",
    trust_score: 90,
    rating_avg: 4.7,
    review_count: 77,
    profile_completeness: 86,
    response_time_hours: 1,
  },
];

async function ensureOwner(owner) {
  const { data: existing } = await supabase.auth.admin.getUserById(owner.ownerId);
  if (!existing?.user) {
    const { error } = await supabase.auth.admin.createUser({
      id: owner.ownerId,
      email: owner.email,
      password: SEED_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`auth user ${owner.email}: ${error.message}`);
  }

  const { data: appUser } = await supabase.from("users").select("id").eq("id", owner.ownerId).maybeSingle();
  if (!appUser) {
    const { error } = await supabase.from("users").insert({
      id: owner.ownerId,
      email: owner.email,
      preferred_locale: "ar",
    });
    if (error) throw new Error(`users ${owner.email}: ${error.message}`);
  }

  const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", owner.ownerId).maybeSingle();
  if (!profile) {
    const { error } = await supabase.from("profiles").insert({
      user_id: owner.ownerId,
      display_name: owner.displayName,
    });
    if (error) throw new Error(`profiles ${owner.email}: ${error.message}`);
  }

  const { data: role } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", owner.ownerId)
    .eq("role", "business")
    .is("revoked_at", null)
    .maybeSingle();

  if (!role) {
    const { error } = await supabase.from("user_roles").insert({
      user_id: owner.ownerId,
      role: "business",
    });
    if (error) throw new Error(`user_roles ${owner.email}: ${error.message}`);
  }
}

async function upsertProvider(provider) {
  const row = {
    id: provider.id,
    owner_id: provider.ownerId,
    slug: provider.slug,
    name: provider.name,
    about: provider.about,
    module_id: MODULE_SERVICES_ID,
    category_id: provider.category_id,
    city_id: provider.city_id,
    status: "active",
    verification_status: "verified",
    trust_score: provider.trust_score,
    rating_avg: provider.rating_avg,
    review_count: provider.review_count,
    profile_completeness: provider.profile_completeness,
    response_time_hours: provider.response_time_hours,
    published_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("providers").upsert(row, { onConflict: "id" });
  if (error) throw new Error(`provider ${provider.slug}: ${error.message}`);
}

async function upsertApprovedVerification(providerId) {
  const { error } = await supabase.from("provider_verifications").upsert(
    {
      provider_id: providerId,
      id_front_url: `${providerId}/seed/id_front.jpg`,
      id_back_url: `${providerId}/seed/id_back.jpg`,
      selfie_url: `${providerId}/seed/selfie.jpg`,
      status: "approved",
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "provider_id" },
  );

  if (error) throw new Error(`verification ${providerId}: ${error.message}`);
}

async function main() {
  console.log("Seeding search demo providers...");

  for (const owner of OWNERS) {
    await ensureOwner(owner);
  }

  for (const provider of PROVIDERS) {
    await upsertProvider(provider);
    await upsertApprovedVerification(provider.id);
  }

  console.log(`Seeded ${PROVIDERS.length} active providers with approved verifications.`);
  console.log("");
  console.log("Test queries:");
  console.log('  EN /ar/search?q=My sink is leaking');
  console.log('  AR /en/search?q=المغسلة عم تسرب');
  console.log('  EN /ar/search?q=Power is out');
  console.log('  EN /ar/search?q=My AC is not cooling');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
