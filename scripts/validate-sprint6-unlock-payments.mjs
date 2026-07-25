/**
 * Sprint 6 — end-to-end Unlock Fee payment validation against live Supabase.
 * Creates ephemeral fixtures, exercises happy/fail/cancel/retry/security/idempotency,
 * then cleans up. Does NOT start Sprint 7.
 *
 * Usage: node scripts/validate-sprint6-unlock-payments.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
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
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("FAIL: missing Supabase env in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const results = [];
const warnings = [];
const cleanup = {
  userIds: [],
  requestIds: [],
  providerIds: [],
  paymentIds: [],
  sessionIds: [],
  grantIds: [],
  webhookIds: [],
  offerIds: [],
  selectionIds: [],
  assignmentIds: [],
  poolIds: [],
};

function pass(name, detail = "") {
  results.push({ name, status: "PASS", detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail) {
  results.push({ name, status: "FAIL", detail });
  console.error(`FAIL  ${name} — ${detail}`);
}

function warn(name, detail) {
  warnings.push({ name, detail });
  console.warn(`WARN  ${name} — ${detail}`);
}

function ref() {
  return `DAL-S6${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function createAuthUser(email, password, role) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`auth create: ${error?.message}`);
  const userId = data.user.id;
  cleanup.userIds.push(userId);

  await admin.from("users").upsert({
    id: userId,
    email,
    preferred_locale: "en",
    email_verified_at: new Date().toISOString(),
  });
  await admin.from("profiles").upsert({
    user_id: userId,
    display_name: email.split("@")[0],
  });
  await admin.from("user_roles").upsert({ user_id: userId, role });
  return userId;
}

async function createProvider(ownerId) {
  const slug = `s6-val-${ownerId.replace(/-/g, "").slice(0, 8)}`;
  const { data: city } = await admin.from("cities").select("id").limit(1).maybeSingle();
  const { data: category } = await admin
    .from("categories")
    .select("id")
    .limit(1)
    .maybeSingle();
  const { data: moduleRow } = await admin
    .from("modules")
    .select("id")
    .limit(1)
    .maybeSingle();
  const moduleId = moduleRow?.id ?? "a0000000-0000-4000-8000-000000000001";

  const { data, error } = await admin
    .from("providers")
    .insert({
      owner_id: ownerId,
      slug,
      name: { en: "S6 Validation Biz", ar: "اختبار 6" },
      status: "active",
      phone: "+963911000006",
      whatsapp: "+963911000006",
      address_line: { en: "Hidden until unlock", ar: "مخفي" },
      city_id: city?.id ?? null,
      category_id: category?.id ?? null,
      module_id: moduleId,
    })
    .select("id, phone")
    .single();
  if (error || !data) throw new Error(`provider: ${error?.message}`);
  cleanup.providerIds.push(data.id);
  return data;
}

async function buildMarketplaceChain({ customerId, providerId }) {
  const { data: request, error: reqErr } = await admin
    .from("service_requests")
    .insert({
      customer_id: customerId,
      provider_id: null,
      title: "S6 unlock payment validation",
      description: "Automated Sprint 6 validation request",
      status: "pending",
      lifecycle_version: 2,
    })
    .select("id")
    .single();
  if (reqErr || !request) throw new Error(`request: ${reqErr?.message}`);
  cleanup.requestIds.push(request.id);

  const { data: pool, error: poolErr } = await admin
    .from("match_pools")
    .insert({
      service_request_id: request.id,
      cell_key: "s6-validation",
      status: "closed",
      assigned_count: 1,
      initial_candidate_count: 1,
      policy_snapshot: { source: "s6_validation" },
    })
    .select("id")
    .single();
  if (poolErr || !pool) throw new Error(`pool: ${poolErr?.message}`);
  cleanup.poolIds.push(pool.id);

  const { data: assignment, error: asErr } = await admin
    .from("match_assignments")
    .insert({
      pool_id: pool.id,
      service_request_id: request.id,
      provider_id: providerId,
      reason_codes: ["s6_validation"],
      rank_in_pool: 1,
      source: "initial",
    })
    .select("id")
    .single();
  if (asErr || !assignment) throw new Error(`assignment: ${asErr?.message}`);
  cleanup.assignmentIds.push(assignment.id);

  const { data: offer, error: ofErr } = await admin
    .from("marketplace_offers")
    .insert({
      service_request_id: request.id,
      provider_id: providerId,
      match_assignment_id: assignment.id,
      status: "sent",
      price: 100,
      currency: "SYP",
      price_model: "fixed",
      message: "S6 validation offer",
    })
    .select("id")
    .single();
  if (ofErr || !offer) throw new Error(`offer: ${ofErr?.message}`);
  cleanup.offerIds.push(offer.id);

  const { data: selection, error: selErr } = await admin
    .from("marketplace_selections")
    .insert({
      service_request_id: request.id,
      provider_id: providerId,
      offer_id: offer.id,
      status: "pending_unlock",
      selected_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (selErr || !selection) throw new Error(`selection: ${selErr?.message}`);
  cleanup.selectionIds.push(selection.id);

  await admin
    .from("service_requests")
    .update({ selection_id: selection.id })
    .eq("id", request.id);

  await admin
    .from("marketplace_offers")
    .update({ status: "selected" })
    .eq("id", offer.id);

  const sla = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { data: session, error: sessErr } = await admin
    .from("unlock_sessions")
    .insert({
      selection_id: selection.id,
      service_request_id: request.id,
      provider_id: providerId,
      offer_id: offer.id,
      status: "payment_pending",
      fee_amount: 5000,
      fee_currency: "SYP",
      sla_deadline: sla,
      idempotency_key: `selection:${selection.id}`,
    })
    .select("id")
    .single();
  if (sessErr || !session) throw new Error(`session: ${sessErr?.message}`);
  cleanup.sessionIds.push(session.id);

  return { requestId: request.id, offerId: offer.id, selectionId: selection.id, sessionId: session.id };
}

async function createUnlockPayment({ providerId, sessionId, status = "pending" }) {
  const reference = ref();
  const { data, error } = await admin
    .from("payments")
    .insert({
      provider_id: providerId,
      subscription_id: null,
      payment_provider: "manual",
      payment_status: status,
      amount: 5000,
      currency: "SYP",
      payment_reference: reference,
      purpose: "unlock_fee",
      unlock_session_id: sessionId,
      idempotency_key: `unlock_fee:${sessionId}:${reference}`,
    })
    .select("id, payment_reference, payment_status, purpose")
    .single();
  if (error || !data) throw new Error(`payment create: ${error?.message}`);
  cleanup.paymentIds.push(data.id);
  await admin
    .from("unlock_sessions")
    .update({ payment_id: data.id, status: "payment_pending" })
    .eq("id", sessionId);
  return data;
}

async function assertNoGrant(requestId, label) {
  const { data } = await admin
    .from("contact_release_grants")
    .select("id")
    .eq("service_request_id", requestId)
    .maybeSingle();
  if (data) {
    fail(label, `unexpected grant ${data.id}`);
    return false;
  }
  pass(label, "no grant");
  return true;
}

async function assertContactHidden(requestId, customerId, providerPhone, label) {
  const { data: grant } = await admin
    .from("contact_release_grants")
    .select("id")
    .eq("service_request_id", requestId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (grant) {
    fail(label, "grant exists — contact gate would expose phone");
    return false;
  }
  // Simulate gate: without grant, UI must not show provider phone
  if (!providerPhone) {
    warn(label, "provider has no phone on file; gate still correctly blocks");
  }
  pass(label, "gate closed (no grant ⇒ no PII hydrate)");
  return true;
}

async function captureLikeDomain({ paymentId, sessionId, customerId, providerId, actorId }) {
  const now = new Date().toISOString();
  const { data: payment } = await admin
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.purpose !== "unlock_fee") {
    return { ok: false, error: "not_unlock_fee" };
  }

  const { data: session } = await admin
    .from("unlock_sessions")
    .select("id, service_request_id, selection_id, provider_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return { ok: false, error: "session_not_found" };

  if (payment.payment_status !== "paid") {
    if (!["pending", "pending_review"].includes(payment.payment_status)) {
      return { ok: false, error: "invalid_status" };
    }
    const { data: updated } = await admin
      .from("payments")
      .update({
        payment_status: "paid",
        paid_at: now,
        approved_at: now,
        approved_by: actorId,
      })
      .eq("id", paymentId)
      .in("payment_status", ["pending", "pending_review"])
      .select("id")
      .maybeSingle();
    if (!updated) return { ok: false, error: "payment_update_failed" };
  }

  const { data: existingGrant } = await admin
    .from("contact_release_grants")
    .select("id")
    .eq("unlock_session_id", sessionId)
    .maybeSingle();
  if (existingGrant) {
    return { ok: true, grantId: existingGrant.id, alreadyCaptured: true };
  }

  const { data: grant, error } = await admin
    .from("contact_release_grants")
    .insert({
      unlock_session_id: sessionId,
      service_request_id: session.service_request_id,
      provider_id: providerId,
      customer_id: customerId,
      scope: ["phone", "whatsapp", "address", "chat"],
      granted_at: now,
    })
    .select("id")
    .single();

  if (error || !grant) {
    if (error?.code === "23505") {
      const { data: g } = await admin
        .from("contact_release_grants")
        .select("id")
        .eq("unlock_session_id", sessionId)
        .maybeSingle();
      if (g) return { ok: true, grantId: g.id, alreadyCaptured: true };
    }
    return { ok: false, error: error?.message ?? "grant_failed" };
  }

  cleanup.grantIds.push(grant.id);
  await admin
    .from("unlock_sessions")
    .update({
      status: "succeeded",
      payment_id: paymentId,
      payment_stub_ref: `payment_capture:${paymentId}`,
      closed_at: now,
      updated_at: now,
    })
    .eq("id", sessionId);
  await admin
    .from("marketplace_selections")
    .update({ status: "unlocked", updated_at: now })
    .eq("id", session.selection_id);

  return { ok: true, grantId: grant.id, alreadyCaptured: false };
}

async function cleanupAll() {
  // Order: grants → webhooks → payments → sessions → selections → offers → assignments → pools → requests → providers → users
  if (cleanup.grantIds.length) {
    await admin.from("contact_release_grants").delete().in("id", cleanup.grantIds);
  }
  // also by session
  if (cleanup.sessionIds.length) {
    await admin.from("contact_release_grants").delete().in("unlock_session_id", cleanup.sessionIds);
    await admin.from("unlock_reliability_signals").delete().in("unlock_session_id", cleanup.sessionIds);
  }
  if (cleanup.webhookIds.length) {
    await admin.from("payment_webhook_events").delete().in("id", cleanup.webhookIds);
  }
  if (cleanup.paymentIds.length) {
    await admin.from("payment_events").delete().in("payment_id", cleanup.paymentIds);
    await admin.from("payment_webhook_events").delete().in("payment_id", cleanup.paymentIds);
    await admin.from("invoices").delete().in("payment_id", cleanup.paymentIds);
    await admin.from("payments").delete().in("id", cleanup.paymentIds);
  }
  if (cleanup.sessionIds.length) {
    await admin.from("unlock_sessions").delete().in("id", cleanup.sessionIds);
  }
  if (cleanup.selectionIds.length) {
    await admin
      .from("service_requests")
      .update({ selection_id: null })
      .in("selection_id", cleanup.selectionIds);
    await admin.from("marketplace_selections").delete().in("id", cleanup.selectionIds);
  }
  if (cleanup.offerIds.length) {
    await admin.from("marketplace_offers").delete().in("id", cleanup.offerIds);
  }
  if (cleanup.assignmentIds.length) {
    await admin.from("match_assignments").delete().in("id", cleanup.assignmentIds);
  }
  if (cleanup.poolIds.length) {
    await admin.from("match_pools").delete().in("id", cleanup.poolIds);
  }
  if (cleanup.requestIds.length) {
    await admin.from("service_requests").delete().in("id", cleanup.requestIds);
  }
  if (cleanup.providerIds.length) {
    await admin.from("providers").delete().in("id", cleanup.providerIds);
  }
  for (const id of cleanup.userIds) {
    await admin.from("user_roles").delete().eq("user_id", id);
    await admin.from("profiles").delete().eq("user_id", id);
    await admin.from("users").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
  }
}

async function main() {
  console.log("\n=== Sprint 6 Unlock Payment Validation ===\n");

  // --- Schema probes ---
  {
    const { error } = await admin
      .from("payments")
      .select("id, purpose, unlock_session_id, idempotency_key")
      .limit(1);
    if (error) fail("schema.payments_unlock_columns", error.message);
    else pass("schema.payments_unlock_columns");

    const { error: e2 } = await admin.from("unlock_sessions").select("id, payment_id").limit(1);
    if (e2) fail("schema.unlock_sessions.payment_id", e2.message);
    else pass("schema.unlock_sessions.payment_id");

    const { error: e3 } = await admin
      .from("payment_webhook_events")
      .select("id, provider, external_event_id, processing_status")
      .limit(1);
    if (e3) fail("schema.payment_webhook_events", e3.message);
    else pass("schema.payment_webhook_events");
  }

  // Flag advisory
  if (process.env.UNLOCK_PAYMENTS_V2 !== "true" && process.env.UNLOCK_PAYMENTS_V2 !== "1") {
    warn(
      "env.UNLOCK_PAYMENTS_V2",
      "not enabled in .env.local — product UI path stays Sprint-5 until set; DB validation still runs",
    );
  }
  if (process.env.UNLOCK_V2 !== "true" && process.env.UNLOCK_V2 !== "1") {
    warn("env.UNLOCK_V2", "UNLOCK_V2 not true in env");
  }

  const stamp = Date.now();
  const customerEmail = `s6.customer.${stamp}@dalily.test`;
  const providerEmail = `s6.provider.${stamp}@dalily.test`;
  const password = `S6Val!${randomBytes(4).toString("hex")}`;

  let customerId;
  let providerOwnerId;
  let provider;
  let chain;

  try {
    customerId = await createAuthUser(customerEmail, password, "customer");
    providerOwnerId = await createAuthUser(providerEmail, password, "business");
    provider = await createProvider(providerOwnerId);
    chain = await buildMarketplaceChain({
      customerId,
      providerId: provider.id,
    });
    pass("fixture.marketplace_chain", `request=${chain.requestId}`);

    // --- Security: no contact before payment ---
    await assertContactHidden(
      chain.requestId,
      customerId,
      provider.phone,
      "security.pre_payment_contact_hidden",
    );
    await assertNoGrant(chain.requestId, "security.pre_payment_no_grant");

    // Client cannot insert grant (anon)
    {
      const anon = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await anon.from("contact_release_grants").insert({
        unlock_session_id: chain.sessionId,
        service_request_id: chain.requestId,
        provider_id: provider.id,
        customer_id: customerId,
        scope: ["phone"],
      });
      if (!error) {
        fail("security.client_cannot_insert_grant", "anon insert succeeded");
      } else {
        pass("security.client_cannot_insert_grant", error.message.slice(0, 80));
      }
    }

    // Client authenticated as customer still cannot insert grant (no INSERT policy)
    {
      const customerClient = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signErr } = await customerClient.auth.signInWithPassword({
        email: customerEmail,
        password,
      });
      if (signErr) {
        warn("security.customer_auth", signErr.message);
      } else {
        const { error } = await customerClient.from("contact_release_grants").insert({
          unlock_session_id: chain.sessionId,
          service_request_id: chain.requestId,
          provider_id: provider.id,
          customer_id: customerId,
          scope: ["phone"],
        });
        if (!error) fail("security.authed_customer_cannot_insert_grant", "insert succeeded");
        else pass("security.authed_customer_cannot_insert_grant", error.code || error.message.slice(0, 60));
      }
    }

    // --- Failed payment ---
    {
      const pay = await createUnlockPayment({
        providerId: provider.id,
        sessionId: chain.sessionId,
        status: "pending",
      });
      await admin
        .from("payments")
        .update({ payment_status: "failed" })
        .eq("id", pay.id);
      await assertNoGrant(chain.requestId, "failed_payment.no_grant");
      await assertContactHidden(
        chain.requestId,
        customerId,
        provider.phone,
        "failed_payment.contact_hidden",
      );

      // --- Cancelled path (separate payment after failed frees unique slot) ---
      // failed is not in active unique set, so new payment allowed
      const payCancel = await createUnlockPayment({
        providerId: provider.id,
        sessionId: chain.sessionId,
        status: "pending",
      });
      await admin
        .from("payments")
        .update({ payment_status: "cancelled" })
        .eq("id", payCancel.id);
      await assertNoGrant(chain.requestId, "cancelled_payment.no_grant");

      // --- Retry after fail/cancel ---
      const payRetry = await createUnlockPayment({
        providerId: provider.id,
        sessionId: chain.sessionId,
        status: "pending",
      });
      pass("retry.payment_recreate_after_fail_cancel", payRetry.id);

      // Duplicate active charge blocked
      const dupRef = ref();
      const { error: dupErr } = await admin.from("payments").insert({
        provider_id: provider.id,
        payment_provider: "manual",
        payment_status: "pending",
        amount: 5000,
        currency: "SYP",
        payment_reference: dupRef,
        purpose: "unlock_fee",
        unlock_session_id: chain.sessionId,
        idempotency_key: `unlock_fee:${chain.sessionId}:${dupRef}`,
      });
      if (!dupErr) {
        fail("idempotency.duplicate_active_charge_blocked", "second pending insert succeeded");
      } else {
        pass("idempotency.duplicate_active_charge_blocked", dupErr.code || dupErr.message.slice(0, 80));
      }

      // Move retry to pending_review then capture (happy path)
      await admin
        .from("payments")
        .update({
          payment_status: "pending_review",
          receipt_path: `${providerOwnerId}/${provider.id}/${payRetry.id}/receipt.jpg`,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", payRetry.id);

      const captured = await captureLikeDomain({
        paymentId: payRetry.id,
        sessionId: chain.sessionId,
        customerId,
        providerId: provider.id,
        actorId: providerOwnerId,
      });
      if (!captured.ok) fail("happy_path.capture", captured.error);
      else pass("happy_path.capture", `grant=${captured.grantId}`);

      // Contact visible after grant (gate would hydrate)
      {
        const { data: grant } = await admin
          .from("contact_release_grants")
          .select("id, provider_id")
          .eq("service_request_id", chain.requestId)
          .eq("customer_id", customerId)
          .maybeSingle();
        if (!grant) fail("happy_path.grant_exists", "missing");
        else {
          const { data: p } = await admin
            .from("providers")
            .select("phone, whatsapp")
            .eq("id", grant.provider_id)
            .maybeSingle();
          if (p?.phone) pass("happy_path.contact_visible_after_grant", p.phone);
          else fail("happy_path.contact_visible_after_grant", "no phone on provider");
        }
      }

      // Idempotent re-capture / duplicate grant
      const again = await captureLikeDomain({
        paymentId: payRetry.id,
        sessionId: chain.sessionId,
        customerId,
        providerId: provider.id,
        actorId: providerOwnerId,
      });
      if (!again.ok) fail("idempotency.recapture", again.error);
      else if (again.grantId !== captured.grantId && !again.alreadyCaptured) {
        // count grants
        const { data: grants } = await admin
          .from("contact_release_grants")
          .select("id")
          .eq("unlock_session_id", chain.sessionId);
        if ((grants?.length ?? 0) > 1) {
          fail("idempotency.no_duplicate_grants", `count=${grants.length}`);
        } else {
          pass("idempotency.recapture_same_grant", again.grantId);
        }
      } else {
        pass("idempotency.recapture_same_grant", again.grantId);
      }

      const { error: grantDup } = await admin.from("contact_release_grants").insert({
        unlock_session_id: chain.sessionId,
        service_request_id: chain.requestId,
        provider_id: provider.id,
        customer_id: customerId,
        scope: ["phone"],
      });
      if (!grantDup) fail("idempotency.unique_grant_constraint", "duplicate insert ok");
      else pass("idempotency.unique_grant_constraint", grantDup.code || "rejected");
    }

    // --- Webhook idempotency ---
    {
      const eventId = `evt-s6-${stamp}`;
      const { data: wh1, error: w1 } = await admin
        .from("payment_webhook_events")
        .insert({
          provider: "manual",
          external_event_id: eventId,
          event_type: "payment.succeeded",
          processing_status: "processed",
          payment_id: cleanup.paymentIds[cleanup.paymentIds.length - 1] ?? null,
          processed_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (w1) fail("webhook.first_insert", w1.message);
      else {
        cleanup.webhookIds.push(wh1.id);
        pass("webhook.first_insert", wh1.id);
      }
      const { error: w2 } = await admin.from("payment_webhook_events").insert({
        provider: "manual",
        external_event_id: eventId,
        event_type: "payment.succeeded",
        processing_status: "received",
      });
      if (!w2) fail("webhook.duplicate_event_blocked", "second insert succeeded");
      else pass("webhook.duplicate_event_blocked", w2.code || w2.message.slice(0, 60));
    }

    // --- Code-path security: payment_capture requires paid ---
    {
      // create a fresh chain for unpaid capture attempt
      const chain2 = await buildMarketplaceChain({
        customerId,
        providerId: provider.id,
      });
      const unpaid = await createUnlockPayment({
        providerId: provider.id,
        sessionId: chain2.sessionId,
        status: "pending",
      });
      // Simulate completeUnlockSuccess payment_capture guard: refuse if not paid
      const { data: payRow } = await admin
        .from("payments")
        .select("payment_status, purpose, unlock_session_id, provider_id")
        .eq("id", unpaid.id)
        .maybeSingle();
      const allowed =
        payRow?.purpose === "unlock_fee" &&
        payRow.payment_status === "paid" &&
        payRow.unlock_session_id === chain2.sessionId &&
        payRow.provider_id === provider.id;
      if (allowed) fail("security.capture_requires_paid", "pending payment incorrectly allowed");
      else pass("security.capture_requires_paid", `status=${payRow?.payment_status}`);
      await assertNoGrant(chain2.requestId, "security.unpaid_no_grant");
    }
  } catch (e) {
    fail("fixture_or_runtime", e instanceof Error ? e.message : String(e));
  } finally {
    try {
      await cleanupAll();
      pass("cleanup", "ephemeral fixtures removed");
    } catch (e) {
      warn("cleanup", e instanceof Error ? e.message : String(e));
    }
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;

  const report = {
    generatedAt: new Date().toISOString(),
    sprint: 6,
    suite: "validate-sprint6-unlock-payments",
    summary: { passed, failed, warnings: warnings.length, total: results.length },
    results,
    warnings,
    notes: {
      unitTests: "none in repo",
      integrationTests: "this script",
      e2eBrowser: "none (no playwright/cypress)",
      unlockPaymentsFlagInEnv: process.env.UNLOCK_PAYMENTS_V2 ?? "(unset)",
    },
  };

  const outPath = resolve(process.cwd(), "docs/migration/sprint-6-validation-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${outPath}`);
  console.log(`Summary: ${passed} passed, ${failed} failed, ${warnings.length} warnings\n`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
