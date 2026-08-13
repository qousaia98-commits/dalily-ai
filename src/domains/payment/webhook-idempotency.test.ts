import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/domains/payment/webhook-ledger", () => ({
  recordVerifiedPaymentEvent: vi.fn(),
}));

vi.mock("@/lib/payment/event-handler", () => ({
  applyCanonicalPaymentEvent: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({}),
      }),
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "1" }, error: null }),
        }),
      }),
    }),
  })),
}));

vi.mock("@/lib/payment/business-subscription", () => ({
  activateBusinessSubscriptionFromPayment: vi.fn(),
}));
vi.mock("@/lib/monetization/plans", () => ({
  upgradeToBusinessPlan: vi.fn(),
}));
vi.mock("@/lib/payment/status-snapshots", () => ({
  snapshotPaymentStatus: vi.fn(),
}));
vi.mock("@/lib/ai/learning/events", () => ({
  emitAiLearningEvent: vi.fn(),
}));

import { recordVerifiedPaymentEvent } from "@/domains/payment/webhook-ledger";
import { applyCanonicalPaymentEvent } from "@/lib/payment/event-handler";
import { processStripeEvent } from "@/lib/payment/stripe/webhooks";

/**
 * In-memory mock of payment_webhook_events for ledger-level idempotency.
 */
function createInMemoryWebhookClient() {
  const rows = new Map<
    string,
    {
      id: string;
      processing_status: string;
      provider: string;
      external_event_id: string;
    }
  >();
  let seq = 0;
  const key = (provider: string, externalEventId: string) =>
    `${provider}::${externalEventId}`;

  return {
    rows,
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(col1: string, val1: string) {
              return {
                eq(col2: string, val2: string) {
                  return {
                    async maybeSingle() {
                      const provider =
                        col1 === "provider"
                          ? val1
                          : col2 === "provider"
                            ? val2
                            : "";
                      const external =
                        col1 === "external_event_id"
                          ? val1
                          : col2 === "external_event_id"
                            ? val2
                            : "";
                      return { data: rows.get(key(provider, external)) ?? null };
                    },
                  };
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq(_col: string, id: string) {
              for (const [k, row] of rows) {
                if (row.id === id) {
                  rows.set(k, {
                    ...row,
                    processing_status: String(
                      patch.processing_status ?? row.processing_status,
                    ),
                  });
                }
              }
            },
          };
        },
        insert(row: Record<string, unknown>) {
          return {
            select(_cols: string) {
              return {
                async single() {
                  const provider = String(row.provider);
                  const external = String(row.external_event_id);
                  const k = key(provider, external);
                  if (rows.has(k)) {
                    return {
                      data: null,
                      error: { message: "duplicate", code: "23505" },
                    };
                  }
                  seq += 1;
                  const id = `evt_${seq}`;
                  rows.set(k, {
                    id,
                    provider,
                    external_event_id: external,
                    processing_status: String(
                      row.processing_status ?? "received",
                    ),
                  });
                  return { data: { id }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("webhook ledger idempotency (recordVerifiedPaymentEvent)", () => {
  it("same event.id processed twice does not double-insert", async () => {
    // Use real ledger implementation with injected mock client (bypass vi.mock)
    const { recordVerifiedPaymentEvent: recordReal } = await vi.importActual<
      typeof import("@/domains/payment/webhook-ledger")
    >("@/domains/payment/webhook-ledger");

    const client = createInMemoryWebhookClient();
    const eventId = "evt_stripe_abc123";

    const first = await recordReal(
      {
        provider: "stripe",
        externalEventId: eventId,
        eventType: "payment_intent.succeeded",
        payload: { amount: 100 },
      },
      client,
    );
    expect(first.status).toBe("inserted");

    await recordReal(
      {
        provider: "stripe",
        externalEventId: eventId,
        eventType: "payment_intent.succeeded",
        forceStatus: "processed",
        paymentId: "pay_1",
      },
      client,
    );

    const second = await recordReal(
      {
        provider: "stripe",
        externalEventId: eventId,
        eventType: "payment_intent.succeeded",
        payload: { amount: 100 },
      },
      client,
    );

    expect(second.status).toBe("duplicate_processed");
    expect(client.rows.size).toBe(1);
  });
});

describe("processStripeEvent idempotency", () => {
  beforeEach(() => {
    vi.mocked(recordVerifiedPaymentEvent).mockReset();
    vi.mocked(applyCanonicalPaymentEvent).mockReset();
  });

  it("duplicate event.id returns early and never applies canonical side-effects", async () => {
    vi.mocked(recordVerifiedPaymentEvent).mockResolvedValue({
      status: "duplicate_processed",
      eventId: "existing",
    });

    const result = await processStripeEvent({
      id: "evt_dup_replay",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_1",
          metadata: { dalily_payment_id: "pay_should_not_run" },
          latest_charge: null,
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(result).toEqual({ ok: true, duplicate: true });
    expect(applyCanonicalPaymentEvent).not.toHaveBeenCalled();
    expect(recordVerifiedPaymentEvent).toHaveBeenCalledTimes(1);
  });
});
