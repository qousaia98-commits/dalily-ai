import { newSession, closeSession, shot, log, BASE_URL, warmup, dismissModal, adminDb } from "./lib.mjs";

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  log(ok ? "PASS" : "FAIL", name, detail ?? "");
}

const TS = Date.now();
const BIZ_EMAIL = `final.bizreg.${TS}@dalily.local`;
const BIZ_PASSWORD = "FinalBiz51.2!";
const BIZ_NAME = `Final Plumbing ${TS}`;
const CUSTOMER_EMAIL = "final-customer-5512@dalily.local";
const CUSTOMER_PASSWORD = "FinalCustomer51.2!";

async function main() {
  await warmup(["/en/register/business", "/en/login", "/en/register", "/en/business"]);

  // ================= DL-01 =================
  const s = await newSession("dl01");
  const { page: p } = s;
  let sawEarlyPost = false;
  p.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/register/business")) sawEarlyPost = true;
  });

  await p.goto(`${BASE_URL}/en/register/business`, { waitUntil: "networkidle" });
  await dismissModal(p, 1500);
  await p.fill("#businessName", BIZ_NAME);
  await p.getByRole("combobox").first().click();
  await p.waitForTimeout(300);
  await p.getByRole("option", { name: /plumbing/i }).first().click();
  await p.getByRole("combobox").nth(1).click();
  await p.waitForTimeout(300);
  await p.getByRole("option", { name: /damascus/i }).first().click();
  await p.fill("#password", BIZ_PASSWORD);
  await p.fill("#confirmPassword", BIZ_PASSWORD);
  await p.getByRole("button", { name: /^next$/i }).click();
  await p.waitForTimeout(500);
  await p.fill("#phone", "+963911234567");
  await p.fill("#email", BIZ_EMAIL);
  await p.getByRole("button", { name: /^next$/i }).click();
  await p.waitForTimeout(500);
  await p.fill("#about", "We provide emergency plumbing repair services across Damascus, available 24/7.");
  await p.fill("#services", "Leak repair, pipe installation, drain cleaning");

  await p.getByRole("button", { name: /^next$/i }).click();
  await p.waitForTimeout(1200);
  record("DL-01: Review step does not auto-submit", !sawEarlyPost, sawEarlyPost ? "POST fired before explicit submit" : "clean");

  const submitBtn = p.getByRole("button", { name: /complete registration/i });
  const disabledBeforeClick = await submitBtn.getAttribute("disabled");
  record("DL-01: submit button enabled before explicit click", disabledBeforeClick === null, `disabled=${disabledBeforeClick}`);
  await shot(p, "dl01-review");

  await submitBtn.click({ timeout: 10000 });
  await p.waitForURL((u) => !u.pathname.includes("/register/business"), { timeout: 20000 }).catch(() => {});
  await p.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await shot(p, "dl01-after-submit");
  record("DL-01: explicit submit redirects away (success state reached)", !p.url().includes("/register/business"), p.url());

  const db = adminDb();
  const { data: userRow } = await db.from("users").select("id").eq("email", BIZ_EMAIL).maybeSingle();
  const providerRow = userRow
    ? (await db.from("providers").select("id,status").eq("owner_id", userRow.id).maybeSingle()).data
    : null;
  record("DL-01: provider created in DB", Boolean(userRow) && Boolean(providerRow), JSON.stringify({ userRow: Boolean(userRow), providerRow }));
  log("DL-01 issues:", JSON.stringify(s.issues, null, 2));
  await closeSession(s);

  // ================= DL-02 =================
  const s2 = await newSession("dl02");
  const { page: p2 } = s2;

  // Anonymous -> login/register allowed
  await p2.goto(`${BASE_URL}/en/login`, { waitUntil: "networkidle" });
  record("DL-02: anonymous can reach /login", p2.url().includes("/login") && !p2.url().includes("redirect"), p2.url());
  await p2.goto(`${BASE_URL}/en/register`, { waitUntil: "networkidle" });
  record("DL-02: anonymous can reach /register", p2.url().includes("/register") && !p2.url().includes("/business"), p2.url());

  // Authenticated customer -> /register/business works
  await p2.goto(`${BASE_URL}/en/login`, { waitUntil: "networkidle" });
  await p2.fill("#email", CUSTOMER_EMAIL);
  await p2.fill("#password", CUSTOMER_PASSWORD);
  await p2.click('button[type="submit"]');
  await p2.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
  await dismissModal(p2, 2000);
  await p2.goto(`${BASE_URL}/en/register/business`, { waitUntil: "networkidle" });
  await shot(p2, "dl02-customer-register-business");
  record("DL-02: authenticated customer reaches /register/business", p2.url().includes("/register/business"), p2.url());

  // Business user -> cannot re-register (visiting /register/business again should bounce them to their dashboard)
  const s3 = await newSession("dl02-business");
  const { page: p3 } = s3;
  await p3.goto(`${BASE_URL}/en/login`, { waitUntil: "networkidle" });
  await p3.fill("#email", BIZ_EMAIL);
  await p3.fill("#password", BIZ_PASSWORD);
  await p3.click('button[type="submit"]');
  await p3.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
  await dismissModal(p3, 2000);
  await p3.goto(`${BASE_URL}/en/register/business`, { waitUntil: "networkidle" });
  await shot(p3, "dl02-business-cannot-reregister");
  record(
    "DL-02: existing business user cannot re-open /register/business (redirected to dashboard)",
    !p3.url().includes("/register/business"),
    p3.url(),
  );
  await closeSession(s3);

  // Protected routes still secure
  await p2.goto(`${BASE_URL}/en/login`, { waitUntil: "networkidle" });
  record("DL-02 regression: authenticated customer redirected away from /login", !p2.url().includes("/login"), p2.url());
  await closeSession(s2);

  const s4 = await newSession("dl02-anon-secure");
  const { page: p4 } = s4;
  await p4.goto(`${BASE_URL}/en/business`, { waitUntil: "networkidle" });
  record("DL-02 regression: anonymous -> /business still requires login", p4.url().includes("/login"), p4.url());
  await p4.goto(`${BASE_URL}/en/admin`, { waitUntil: "networkidle" });
  record("DL-02 regression: anonymous -> /admin still requires login", p4.url().includes("/login"), p4.url());
  await closeSession(s4);

  console.log("\n===RESULTS_JSON===");
  console.log(JSON.stringify({ results, BIZ_EMAIL, BIZ_PASSWORD }, null, 2));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
