import { newSession, closeSession, shot, log, BASE_URL, warmup, dismissModal, adminDb, hydrationIssues } from "./lib.mjs";

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  log(ok ? "PASS" : "FAIL", name, detail ?? "");
}

const BIZ_EMAIL = process.argv[2];
const BIZ_PASSWORD = process.argv[3] || "FinalBiz51.2!";
const CUSTOMER_EMAIL = "final-customer-5512@dalily.local";
const CUSTOMER_PASSWORD = "FinalCustomer51.2!";
const ADMIN_EMAIL = "final-admin-5512@dalily.local";
const ADMIN_PASSWORD = "FinalAdmin51.2!";

async function main() {
  await warmup(["/en/search", "/en/admin/broadcasts", "/en/business/requests", "/en/business/services"]);

  const db = adminDb();
  const { data: bizUser } = await db.from("users").select("id").eq("email", BIZ_EMAIL).maybeSingle();
  const { data: provider } = await db.from("providers").select("id").eq("owner_id", bizUser.id).maybeSingle();
  const providerId = provider.id;
  // Test setup (mirrors the real admin-approve flow's end state) so requests/search work.
  await db.from("providers").update({ status: "active", verification_status: "verified" }).eq("id", providerId);

  // ---- create a real service request so /business/requests has a row to render ----
  const cust = await newSession("dl03-customer-request");
  const { page: cp } = cust;
  await cp.goto(`${BASE_URL}/en/login`, { waitUntil: "networkidle" });
  await cp.fill("#email", CUSTOMER_EMAIL);
  await cp.fill("#password", CUSTOMER_PASSWORD);
  await cp.click('button[type="submit"]');
  await cp.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
  await dismissModal(cp, 2000);

  const REQUEST_TITLE = `Final DL03 Request ${Date.now()}`;
  await cp.goto(`${BASE_URL}/en/providers/${providerId}`, { waitUntil: "networkidle" });
  await dismissModal(cp, 1500);
  const sendBtn = cp.getByRole("button", { name: /send.*request/i }).first();
  const hasSend = await sendBtn.count();
  if (hasSend) {
    await sendBtn.click();
    await cp.waitForTimeout(500);
    await cp.fill("#request-title", REQUEST_TITLE);
    await cp.fill("#request-description", "Final regression DL-03 setup — pipe burst under the sink.");
    await cp.getByRole("button", { name: /send request/i }).first().click({ timeout: 10000 });
    await cp.waitForTimeout(2500);
  }
  await closeSession(cust);

  // ---- DL-03: Business Requests hydration + click-through ----
  const biz = await newSession("dl03-business-requests");
  const { page: bp } = biz;
  await bp.goto(`${BASE_URL}/en/login`, { waitUntil: "networkidle" });
  await bp.fill("#email", BIZ_EMAIL);
  await bp.fill("#password", BIZ_PASSWORD);
  await bp.click('button[type="submit"]');
  await bp.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
  await dismissModal(bp, 2000);

  await bp.goto(`${BASE_URL}/en/business/requests`, { waitUntil: "networkidle" });
  await dismissModal(bp, 1500);
  await bp.waitForTimeout(1500);
  await shot(bp, "dl03-business-requests");
  record("DL-03: zero hydration issues on Business Requests", hydrationIssues(biz.issues).length === 0, JSON.stringify(hydrationIssues(biz.issues)));

  const reqCard = bp.locator(`a[href*="/business/requests/"]`).first();
  if (await reqCard.count()) {
    const beforeUrl = bp.url();
    await reqCard.click();
    await bp.waitForURL((u) => u.href !== beforeUrl, { timeout: 15000 }).catch(() => {});
    await shot(bp, "dl03-business-requests-clicked");
    record("DL-03: request card opens correctly", bp.url() !== beforeUrl && bp.url().includes("/business/requests/"), bp.url());
  } else {
    record("DL-03: request card present to click", false, "no request found");
  }

  // ---- DL-03: Search hydration ----
  await bp.goto(`${BASE_URL}/en/search?q=plumbing`, { waitUntil: "networkidle" });
  await dismissModal(bp, 1500);
  await bp.waitForTimeout(1500);
  await shot(bp, "dl03-search");
  record("DL-03: zero hydration issues on Search", hydrationIssues(biz.issues).length === 0, JSON.stringify(hydrationIssues(biz.issues)));
  await closeSession(biz);

  // ---- DL-03: Admin Broadcasts hydration ----
  const admin = await newSession("dl03-admin-broadcasts");
  const { page: ap } = admin;
  await ap.goto(`${BASE_URL}/en/login`, { waitUntil: "networkidle" });
  await ap.fill("#email", ADMIN_EMAIL);
  await ap.fill("#password", ADMIN_PASSWORD);
  await ap.click('button[type="submit"]');
  await ap.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
  await dismissModal(ap, 2000);
  await ap.goto(`${BASE_URL}/en/admin/broadcasts`, { waitUntil: "networkidle" });
  await ap.waitForTimeout(1500);
  await shot(ap, "dl03-admin-broadcasts");
  record("DL-03: zero hydration issues on Admin Broadcasts", hydrationIssues(admin.issues).length === 0, JSON.stringify(hydrationIssues(admin.issues)));
  await closeSession(admin);

  // ================= DL-04: full CRUD =================
  const s4 = await newSession("dl04-services");
  const { page: p4 } = s4;
  await p4.goto(`${BASE_URL}/en/login`, { waitUntil: "networkidle" });
  await p4.fill("#email", BIZ_EMAIL);
  await p4.fill("#password", BIZ_PASSWORD);
  await p4.click('button[type="submit"]');
  await p4.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
  await dismissModal(p4, 2000);

  await p4.goto(`${BASE_URL}/en/business/services`, { waitUntil: "networkidle" });
  await dismissModal(p4, 1500);

  // -- Add, immediate submit right after typing (the exact original DL-04 repro) --
  const SERVICE_NAME = `Emergency Leak Repair ${Date.now()}`;
  await p4.fill("#serviceName", SERVICE_NAME);
  await p4.getByRole("button", { name: /add service/i }).click({ timeout: 10000 });
  let sawAdded = false, sawInList = false;
  for (let i = 0; i < 12; i++) {
    await p4.waitForTimeout(1000);
    const body = await p4.locator("body").innerText();
    if (/service added/i.test(body)) sawAdded = true;
    if (body.includes(SERVICE_NAME) && body.indexOf(SERVICE_NAME) < body.indexOf("Add new service")) sawInList = true;
    if (sawAdded && sawInList) break;
  }
  await shot(p4, "dl04-added");
  record("DL-04: add service — immediate submit succeeds with success message", sawAdded, "");
  record("DL-04: add service — appears in list with no reload", sawInList, "");

  // -- Translation preview still works --
  const previewVisible = await p4.locator('text=/Dalily will also save/i').isVisible().catch(() => false);
  record("DL-04: translation preview rendered", previewVisible, "");

  const { data: provider2 } = await db.from("providers").select("id").eq("owner_id", bizUser.id).maybeSingle();
  let { data: serviceRows } = await db.from("provider_services").select("id,name").eq("provider_id", provider2.id);
  record("DL-04: provider_services row created in DB", Array.isArray(serviceRows) && serviceRows.length > 0, JSON.stringify(serviceRows));

  // -- Edit the service --
  if (serviceRows && serviceRows.length > 0) {
    const editBtn = p4.getByRole("button", { name: /edit/i }).first();
    if (await editBtn.count()) {
      await editBtn.click();
      await p4.waitForTimeout(500);
      const editInput = p4.locator('input[id^="edit-name-"]').first();
      const UPDATED_NAME = `${SERVICE_NAME} (updated)`;
      await editInput.fill(UPDATED_NAME);
      await p4.getByRole("button", { name: /^save$/i }).click({ timeout: 10000 });
      let sawUpdated = false;
      for (let i = 0; i < 10; i++) {
        await p4.waitForTimeout(1000);
        const body = await p4.locator("body").innerText();
        if (body.includes(UPDATED_NAME)) { sawUpdated = true; break; }
      }
      await shot(p4, "dl04-edited");
      record("DL-04: edit service succeeds and reflects in UI", sawUpdated, "");
      const { data: rowsAfterEdit } = await db.from("provider_services").select("name").eq("id", serviceRows[0].id).maybeSingle();
      record("DL-04: edited name persisted in DB", rowsAfterEdit?.name?.en === UPDATED_NAME, JSON.stringify(rowsAfterEdit));
    } else {
      record("DL-04: Edit button available", false, "not found");
    }
  }

  // -- Delete the service --
  ({ data: serviceRows } = await db.from("provider_services").select("id,name").eq("provider_id", provider2.id));
  if (serviceRows && serviceRows.length > 0) {
    const beforeCount = serviceRows.length;
    const removeBtn = p4.getByRole("button", { name: /remove/i }).first();
    if (await removeBtn.count()) {
      await removeBtn.click({ timeout: 10000 });
      await p4.waitForTimeout(2500);
      await shot(p4, "dl04-deleted");
      const { data: rowsAfterDelete } = await db.from("provider_services").select("id").eq("provider_id", provider2.id);
      record(
        "DL-04: delete service removes the DB row",
        Array.isArray(rowsAfterDelete) && rowsAfterDelete.length === beforeCount - 1,
        `before=${beforeCount} after=${rowsAfterDelete?.length}`,
      );
    } else {
      record("DL-04: Remove button available", false, "not found");
    }
  }

  log("DL-04 issues:", JSON.stringify(s4.issues, null, 2));
  await closeSession(s4);

  console.log("\n===RESULTS_JSON===");
  console.log(JSON.stringify({ results }, null, 2));
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
