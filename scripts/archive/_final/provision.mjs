import { adminDb, log } from "./lib.mjs";

const ACCOUNTS = {
  ADMIN: { email: "final-admin-5512@dalily.local", password: "FinalAdmin51.2!", displayName: "Final Admin 51.2", role: "admin" },
  CUSTOMER: { email: "final-customer-5512@dalily.local", password: "FinalCustomer51.2!", displayName: "Final Customer 51.2", role: "user" },
};

async function ensureUser(db, { email, password, displayName, role }) {
  const { data: existing } = await db.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) {
    log("exists:", email, existing.id);
    return existing.id;
  }
  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  const userId = created.user.id;
  await db.from("users").insert({ id: userId, email, preferred_locale: "en", email_verified_at: new Date().toISOString() });
  await db.from("profiles").insert({ user_id: userId, display_name: displayName });
  await db.from("user_roles").insert({ user_id: userId, role });
  log("provisioned:", email, userId);
  return userId;
}

async function main() {
  const db = adminDb();
  for (const acc of Object.values(ACCOUNTS)) {
    await ensureUser(db, acc);
  }
  console.log(JSON.stringify(ACCOUNTS));
}

main().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(1);
});
