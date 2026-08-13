import { expect, test } from "@playwright/test";

/**
 * RC2.1 — unauthorized payment API access must not leak data.
 */
test.describe("Payment authorization smoke", () => {
  test("GET /api/payments/transactions without session → 401", async ({
    request,
  }) => {
    const res = await request.get("/api/payments/transactions");
    expect([401, 404]).toContain(res.status());
  });

  test("GET /api/payments/transactions?paymentId= without session → 401", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/payments/transactions?paymentId=00000000-0000-4000-8000-000000000001",
    );
    expect([401, 404]).toContain(res.status());
  });

  test("GET /api/payments/status?escrowId= without session → 401", async ({
    request,
  }) => {
    const res = await request.get(
      "/api/payments/status?escrowId=00000000-0000-4000-8000-000000000001",
    );
    expect([401, 404]).toContain(res.status());
  });

  test("GET /api/payments/wallet without session → 401", async ({ request }) => {
    const res = await request.get("/api/payments/wallet");
    expect([401, 404]).toContain(res.status());
  });

  test("GET /api/payments/payouts without session → 401", async ({ request }) => {
    const res = await request.get("/api/payments/payouts");
    expect([401, 404]).toContain(res.status());
  });
});

test.describe("Cron authentication smoke", () => {
  test("cron without secret header is rejected (401 or 500)", async ({
    request,
  }) => {
    const res = await request.post("/api/cron/booking-completion");
    // Missing CRON_SECRET in env → 500; present but no bearer → 401
    expect([401, 500]).toContain(res.status());
    const body = await res.json().catch(() => ({}));
    expect(body.ok).not.toBe(true);
  });

  test("cron with wrong bearer is unauthorized when secret configured", async ({
    request,
  }) => {
    const res = await request.post("/api/cron/booking-completion", {
      headers: { Authorization: "Bearer clearly-wrong-token" },
    });
    // If CRON_SECRET missing → 500; if set → 401
    expect([401, 500]).toContain(res.status());
  });
});
