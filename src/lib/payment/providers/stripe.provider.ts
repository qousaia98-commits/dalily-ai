/**
 * Sprint 6 Phase 3 — real Stripe PaymentProvider.
 * Implements PaymentProvider only for create/verify/cancel/refund.
 * Extra Stripe ops (webhook verify, retrieve, checkout) live as methods
 * on this class but are never imported by business modules directly.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CreatePaymentInput,
  PaymentProvider,
  VerifyPaymentInput,
} from "@/lib/payment/types";
import type {
  CreatePaymentResult,
  VerifyPaymentResult,
} from "@/lib/subscription/types";
import {
  getStripe,
  getStripeBusinessPriceId,
  getStripePublishableKey,
  isStripeConfigured,
  toStripeAmount,
} from "@/lib/payment/stripe/client";
import type Stripe from "stripe";

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

async function ensureStripeCustomer(input: {
  providerId: string;
  email?: string | null;
  name?: string | null;
}): Promise<string> {
  const { data: plan } = await db()
    .from("provider_monetization_plans")
    .select("stripe_customer_id")
    .eq("provider_id", input.providerId)
    .maybeSingle();

  if (plan?.stripe_customer_id) {
    return String(plan.stripe_customer_id);
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create(
    {
      email: input.email || undefined,
      name: input.name || undefined,
      metadata: { dalily_provider_id: input.providerId },
    },
    { idempotencyKey: `cust:${input.providerId}` },
  );

  await db()
    .from("provider_monetization_plans")
    .upsert(
      {
        provider_id: input.providerId,
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider_id" },
    );

  return customer.id;
}

async function loadProviderContact(providerId: string): Promise<{
  email: string | null;
  name: string | null;
}> {
  const { data } = await db()
    .from("providers")
    .select("email, name")
    .eq("id", providerId)
    .maybeSingle();
  const nameJson = data?.name as { en?: string; ar?: string } | null;
  return {
    email: data?.email ? String(data.email) : null,
    name: nameJson?.en || nameJson?.ar || null,
  };
}

export class StripePaymentProvider implements PaymentProvider {
  readonly name = "stripe";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!isStripeConfigured()) {
      throw new Error("stripe_not_configured");
    }

    const purpose = input.purpose ?? "subscription";
    const contact = await loadProviderContact(input.providerId);
    const customerId = await ensureStripeCustomer({
      providerId: input.providerId,
      email: contact.email,
      name: contact.name,
    });

    const { data: payment, error } = await db()
      .from("payments")
      .insert({
        provider_id: input.providerId,
        subscription_id: input.subscriptionId ?? null,
        payment_provider: "stripe",
        payment_status: "pending",
        amount: input.amount,
        currency: input.currency,
        payment_reference: input.reference,
        purpose,
        unlock_session_id: input.unlockSessionId ?? null,
        idempotency_key: input.idempotencyKey ?? null,
        provider_reference: null,
      })
      .select("id")
      .single();

    if (error || !payment) {
      throw new Error(error?.message ?? "payment_create_failed");
    }

    const paymentId = String(payment.id);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://localhost:3000";

    // Business subscription → Stripe Checkout (Billing)
    if (purpose === "business_subscription") {
      const priceId = getStripeBusinessPriceId();
      if (!priceId) {
        throw new Error("stripe_business_price_missing");
      }

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${appUrl}/business/monetization?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/business/monetization?checkout=cancel`,
          client_reference_id: paymentId,
          metadata: {
            dalily_payment_id: paymentId,
            dalily_provider_id: input.providerId,
            purpose: "business_subscription",
          },
          subscription_data: {
            metadata: {
              dalily_payment_id: paymentId,
              dalily_provider_id: input.providerId,
              purpose: "business_subscription",
            },
          },
          payment_method_types: ["card"],
          // Wallets (Apple Pay / Google Pay) appear via Checkout when enabled in Stripe Dashboard.
          // SEPA / bank transfer can be added later via payment_method_types.
          allow_promotion_codes: false,
        },
        {
          idempotencyKey:
            input.idempotencyKey ?? `checkout:${paymentId}`,
        },
      );

      await db()
        .from("payments")
        .update({
          stripe_checkout_session_id: session.id,
          provider_reference: session.id,
          metadata: {
            stripe_customer_id: customerId,
            checkout_mode: "subscription",
          },
        })
        .eq("id", paymentId);

      return {
        paymentId,
        checkoutUrl: session.url ?? undefined,
        stripeCheckoutSessionId: session.id,
        publishableKey: getStripePublishableKey() || undefined,
      };
    }

    // Lead unlock / one-shot → PaymentIntent
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create(
      {
        amount: toStripeAmount(input.amount, input.currency),
        currency: input.currency.toLowerCase(),
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        metadata: {
          dalily_payment_id: paymentId,
          dalily_provider_id: input.providerId,
          purpose,
          unlock_session_id: input.unlockSessionId ?? "",
          reference: input.reference,
        },
        description: `Dalily ${purpose} ${input.reference}`,
      },
      {
        idempotencyKey:
          input.idempotencyKey ?? `pi:${paymentId}:${input.reference}`,
      },
    );

    await db()
      .from("payments")
      .update({
        stripe_payment_intent_id: intent.id,
        provider_reference: intent.id,
        metadata: {
          stripe_customer_id: customerId,
          payment_intent_status: intent.status,
        },
      })
      .eq("id", paymentId);

    return {
      paymentId,
      clientSecret: intent.client_secret ?? undefined,
      stripePaymentIntentId: intent.id,
      publishableKey: getStripePublishableKey() || undefined,
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    if (!isStripeConfigured()) {
      return { success: false, paymentId: input.paymentId };
    }

    const { data: payment } = await db()
      .from("payments")
      .select("id, payment_status, stripe_payment_intent_id, stripe_checkout_session_id")
      .eq("id", input.paymentId)
      .maybeSingle();

    if (!payment) {
      return { success: false, paymentId: input.paymentId };
    }

    if (payment.payment_status === "paid") {
      return {
        success: true,
        paymentId: payment.id,
        externalTransactionId:
          payment.stripe_payment_intent_id ||
          payment.stripe_checkout_session_id ||
          undefined,
      };
    }

    const stripe = getStripe();

    if (payment.stripe_payment_intent_id) {
      const intent = await stripe.paymentIntents.retrieve(
        String(payment.stripe_payment_intent_id),
      );
      if (intent.status === "succeeded") {
        return {
          success: true,
          paymentId: payment.id,
          externalTransactionId: intent.id,
        };
      }
    }

    if (payment.stripe_checkout_session_id) {
      const session = await stripe.checkout.sessions.retrieve(
        String(payment.stripe_checkout_session_id),
      );
      if (session.payment_status === "paid") {
        return {
          success: true,
          paymentId: payment.id,
          externalTransactionId: session.id,
        };
      }
    }

    if (input.externalTransactionId) {
      try {
        const intent = await stripe.paymentIntents.retrieve(
          input.externalTransactionId,
        );
        if (intent.status === "succeeded") {
          return {
            success: true,
            paymentId: payment.id,
            externalTransactionId: intent.id,
          };
        }
      } catch {
        // ignore
      }
    }

    return { success: false, paymentId: input.paymentId };
  }

  async cancelPayment(paymentId: string): Promise<void> {
    if (!isStripeConfigured()) {
      throw new Error("stripe_not_configured");
    }

    const { data: payment } = await db()
      .from("payments")
      .select("id, payment_status, stripe_payment_intent_id, stripe_checkout_session_id")
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment) return;
    if (!["pending", "pending_review"].includes(String(payment.payment_status))) {
      return;
    }

    const stripe = getStripe();
    if (payment.stripe_payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(String(payment.stripe_payment_intent_id));
      } catch {
        // already cancelled / succeeded
      }
    }
    // Checkout sessions expire automatically; mark local row cancelled
    await db()
      .from("payments")
      .update({
        payment_status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", paymentId)
      .in("payment_status", ["pending", "pending_review"]);
  }

  async refund(
    paymentId: string,
    options?: { amount?: number; currency?: string; reason?: string },
  ): Promise<
    | { ok: true; stripeRefundId?: string }
    | { ok: false; error: string }
  > {
    if (!isStripeConfigured()) {
      return { ok: false, error: "stripe_not_configured" };
    }

    const { data: payment } = await db()
      .from("payments")
      .select(
        "id, payment_status, stripe_payment_intent_id, stripe_charge_id, currency",
      )
      .eq("id", paymentId)
      .maybeSingle();

    if (!payment || payment.payment_status !== "paid") {
      return { ok: false, error: "not_refundable" };
    }

    const stripe = getStripe();
    try {
      const currency = (
        options?.currency ||
        payment.currency ||
        "USD"
      ).toLowerCase();
      const createParams: Stripe.RefundCreateParams = {
        metadata: { dalily_payment_id: paymentId },
      };
      if (options?.amount != null) {
        const { toStripeAmount } = await import("@/lib/payment/stripe/client");
        createParams.amount = toStripeAmount(options.amount, currency);
      }
      if (payment.stripe_payment_intent_id) {
        createParams.payment_intent = String(payment.stripe_payment_intent_id);
      } else if (payment.stripe_charge_id) {
        createParams.charge = String(payment.stripe_charge_id);
      } else {
        return { ok: false, error: "no_stripe_charge" };
      }

      const refund = await stripe.refunds.create(createParams);
      // Do not mutate paid → failed.
      return { ok: true, stripeRefundId: refund.id };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "refund_failed",
      };
    }
  }

  /** Retrieve PaymentIntent (provider utility — no business side-effects). */
  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return getStripe().paymentIntents.retrieve(paymentIntentId);
  }

  /** Confirm PaymentIntent server-side when needed (rare; usually client confirms). */
  async confirmPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return getStripe().paymentIntents.confirm(paymentIntentId);
  }

  /** Verify Stripe webhook signature; throws on invalid. */
  constructWebhookEvent(
    rawBody: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return getStripe().webhooks.constructEvent(rawBody, signature, secret);
  }

  async createBillingPortalSession(input: {
    customerId: string;
    returnUrl: string;
  }): Promise<string> {
    const session = await getStripe().billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return session.url;
  }

  async cancelSubscriptionRenewal(subscriptionId: string): Promise<void> {
    await getStripe().subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async listInvoices(customerId: string, limit = 12): Promise<
    Array<{
      id: string;
      number: string | null;
      status: string | null;
      amountPaid: number;
      currency: string;
      hostedInvoiceUrl: string | null;
      created: number;
    }>
  > {
    const invoices = await getStripe().invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      created: inv.created,
    }));
  }
}
