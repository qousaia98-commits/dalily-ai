/**
 * Map Stripe webhook events → canonical payment events + apply side-effects.
 * No Stripe-specific business rules beyond ID resolution.
 */

import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordVerifiedPaymentEvent } from "@/domains/payment/webhook-ledger";
import { applyCanonicalPaymentEvent } from "@/lib/payment/event-handler";
import { activateBusinessSubscriptionFromPayment } from "@/lib/payment/business-subscription";
import { upgradeToBusinessPlan } from "@/lib/monetization/plans";
import { snapshotPaymentStatus } from "@/lib/payment/status-snapshots";
import { emitAiLearningEvent } from "@/lib/ai/learning/events";

function subscriptionPeriod(sub: Stripe.Subscription): {
  start: number | null;
  end: number | null;
} {
  const item = sub.items?.data?.[0];
  return {
    start: item?.current_period_start ?? null,
    end: item?.current_period_end ?? null,
  };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (typeof fromParent === "string") return fromParent;
  if (fromParent && typeof fromParent === "object" && "id" in fromParent) {
    return String((fromParent as { id: string }).id);
  }
  return null;
}

function db() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as any;
}

export type StripeWebhookResult =
  | { ok: true; duplicate?: boolean; paymentId?: string }
  | { ok: false; error: string; status?: number };

async function resolvePaymentIdFromStripe(input: {
  paymentIntentId?: string | null;
  checkoutSessionId?: string | null;
  invoiceId?: string | null;
  metadataPaymentId?: string | null;
}): Promise<string | null> {
  if (input.metadataPaymentId) return input.metadataPaymentId;

  if (input.paymentIntentId) {
    const { data } = await db()
      .from("payments")
      .select("id")
      .eq("stripe_payment_intent_id", input.paymentIntentId)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  if (input.checkoutSessionId) {
    const { data } = await db()
      .from("payments")
      .select("id")
      .eq("stripe_checkout_session_id", input.checkoutSessionId)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  if (input.invoiceId) {
    const { data } = await db()
      .from("payments")
      .select("id")
      .eq("stripe_invoice_id", input.invoiceId)
      .maybeSingle();
    if (data?.id) return String(data.id);
  }

  return null;
}

async function syncSubscriptionFields(input: {
  providerId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  status?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: number | null;
  currentPeriodEnd?: number | null;
}) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.customerId) patch.stripe_customer_id = input.customerId;
  if (input.subscriptionId) patch.stripe_subscription_id = input.subscriptionId;
  if (typeof input.cancelAtPeriodEnd === "boolean") {
    patch.cancel_at_period_end = input.cancelAtPeriodEnd;
    if (input.cancelAtPeriodEnd) {
      patch.renewal_cancelled_at = new Date().toISOString();
    }
  }
  if (input.currentPeriodStart) {
    patch.current_period_start = new Date(
      input.currentPeriodStart * 1000,
    ).toISOString();
    patch.billing_period_start = new Date(input.currentPeriodStart * 1000)
      .toISOString()
      .slice(0, 10);
  }
  if (input.currentPeriodEnd) {
    patch.current_period_end = new Date(
      input.currentPeriodEnd * 1000,
    ).toISOString();
    patch.billing_period_end = new Date(input.currentPeriodEnd * 1000)
      .toISOString()
      .slice(0, 10);
    patch.business_expires_at = new Date(
      input.currentPeriodEnd * 1000,
    ).toISOString();
  }
  if (input.status === "past_due") patch.status = "past_due";
  if (input.status === "active" || input.status === "trialing") {
    patch.status = "active";
    patch.billing_mode = "business";
  }
  if (input.status === "canceled" || input.status === "unpaid") {
    patch.status = "cancelled";
  }

  await db()
    .from("provider_monetization_plans")
    .update(patch)
    .eq("provider_id", input.providerId);
}

/**
 * Process a verified Stripe.Event (signature already checked).
 */
export async function processStripeEvent(
  event: Stripe.Event,
): Promise<StripeWebhookResult> {
  const ledger = await recordVerifiedPaymentEvent({
    provider: "stripe",
    externalEventId: event.id,
    eventType: event.type,
    payload: event.data.object as unknown as Record<string, unknown>,
    forceStatus: undefined,
  });

  if (ledger.status === "duplicate_processed") {
    return { ok: true, duplicate: true };
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = await resolvePaymentIdFromStripe({
          paymentIntentId: pi.id,
          metadataPaymentId: pi.metadata?.dalily_payment_id,
        });
        if (!paymentId) {
          await recordVerifiedPaymentEvent({
            provider: "stripe",
            externalEventId: event.id,
            eventType: event.type,
            forceStatus: "ignored",
            errorMessage: "payment_not_resolved",
          });
          return { ok: true, paymentId: undefined };
        }

        const chargeId =
          typeof pi.latest_charge === "string"
            ? pi.latest_charge
            : pi.latest_charge?.id;
        if (chargeId) {
          await db()
            .from("payments")
            .update({ stripe_charge_id: chargeId })
            .eq("id", paymentId);
        }

        const applied = await applyCanonicalPaymentEvent({
          paymentId,
          eventType: "payment_succeeded",
          actorId: "stripe_webhook",
          externalEventId: event.id,
          source: "webhook",
        });
        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          paymentId,
          forceStatus: applied.ok ? "processed" : "failed",
          errorMessage: applied.ok ? null : applied.error,
        });
        if (!applied.ok) return { ok: false, error: applied.error, status: 409 };
        return { ok: true, paymentId, duplicate: applied.duplicate };
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = await resolvePaymentIdFromStripe({
          paymentIntentId: pi.id,
          metadataPaymentId: pi.metadata?.dalily_payment_id,
        });
        if (!paymentId) {
          await recordVerifiedPaymentEvent({
            provider: "stripe",
            externalEventId: event.id,
            eventType: event.type,
            forceStatus: "ignored",
            errorMessage: "payment_not_resolved",
          });
          return { ok: true };
        }
        const applied = await applyCanonicalPaymentEvent({
          paymentId,
          eventType: "payment_failed",
          actorId: "stripe_webhook",
          externalEventId: event.id,
          source: "webhook",
        });
        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          paymentId,
          forceStatus: applied.ok ? "processed" : "failed",
          errorMessage: applied.ok ? null : applied.error,
        });
        return applied.ok
          ? { ok: true, paymentId }
          : { ok: false, error: applied.error, status: 409 };
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = await resolvePaymentIdFromStripe({
          checkoutSessionId: session.id,
          metadataPaymentId: session.metadata?.dalily_payment_id,
        });
        const providerId =
          session.metadata?.dalily_provider_id ?? null;

        let resolvedProviderId = providerId;
        if (!resolvedProviderId && paymentId) {
          const { data: pay } = await db()
            .from("payments")
            .select("provider_id")
            .eq("id", paymentId)
            .maybeSingle();
          resolvedProviderId = pay?.provider_id
            ? String(pay.provider_id)
            : null;
        }

        if (session.subscription && resolvedProviderId) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : session.customer?.id;
          await syncSubscriptionFields({
            providerId: resolvedProviderId,
            customerId,
            subscriptionId: subId,
            status: "active",
            cancelAtPeriodEnd: false,
          });
          await db()
            .from("business_subscription_payments")
            .update({
              stripe_subscription_id: subId,
              stripe_checkout_session_id: session.id,
            })
            .eq("payment_id", paymentId);
        }

        if (paymentId) {
          const activated = await activateBusinessSubscriptionFromPayment({
            paymentId,
            actorUserId: "stripe_webhook",
            source: "webhook",
          });
          await recordVerifiedPaymentEvent({
            provider: "stripe",
            externalEventId: event.id,
            eventType: event.type,
            paymentId,
            forceStatus: activated.ok ? "processed" : "failed",
            errorMessage: activated.ok ? null : activated.error,
          });
          if (!activated.ok) {
            // One-time checkout (lead) might use PaymentIntent path instead
            const applied = await applyCanonicalPaymentEvent({
              paymentId,
              eventType: "payment_succeeded",
              actorId: "stripe_webhook",
              externalEventId: event.id,
              source: "webhook",
            });
            return applied.ok
              ? { ok: true, paymentId }
              : { ok: false, error: applied.error, status: 409 };
          }
          return { ok: true, paymentId };
        }

        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          forceStatus: "ignored",
          errorMessage: "payment_not_resolved",
        });
        return { ok: true };
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const period = subscriptionPeriod(sub);
        const { data: bySub } = await db()
          .from("provider_monetization_plans")
          .select("provider_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        const providerId =
          sub.metadata?.dalily_provider_id || bySub?.provider_id;

        if (providerId) {
          await syncSubscriptionFields({
            providerId: String(providerId),
            customerId:
              typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
            subscriptionId: sub.id,
            status: sub.status,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
          });
          if (sub.status === "active" || sub.status === "trialing") {
            await upgradeToBusinessPlan({
              providerId: String(providerId),
              actorUserId: "stripe_webhook",
            });
          }
        }
        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          forceStatus: "processed",
        });
        return { ok: true };
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const { data: plan } = await db()
          .from("provider_monetization_plans")
          .select("provider_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        if (plan?.provider_id) {
          await db()
            .from("provider_monetization_plans")
            .update({
              billing_mode: "free",
              status: "cancelled",
              cancel_at_period_end: false,
              premium_badge: false,
              search_boost: false,
              analytics_enabled: false,
              marketing_enabled: false,
              ai_insights_enabled: false,
              stripe_subscription_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("provider_id", plan.provider_id);
          void emitAiLearningEvent({
            eventType: "subscription_cancelled",
            providerId: String(plan.provider_id),
            metadata: { anonymized: true, source: "stripe" },
          });
        }
        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          forceStatus: "processed",
        });
        return { ok: true };
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        let paymentId = await resolvePaymentIdFromStripe({
          invoiceId: invoice.id,
          metadataPaymentId: invoice.metadata?.dalily_payment_id,
        });

        // Renewal invoice: create payment row if missing
        if (!paymentId && subId) {
          const { data: plan } = await db()
            .from("provider_monetization_plans")
            .select("provider_id")
            .eq("stripe_subscription_id", subId)
            .maybeSingle();
          if (
            plan?.provider_id &&
            invoice.billing_reason === "subscription_cycle"
          ) {
            const amount = (invoice.amount_paid ?? 0) / 100;
            const { data: created } = await db()
              .from("payments")
              .insert({
                provider_id: plan.provider_id,
                payment_provider: "stripe",
                payment_status: "paid",
                amount,
                currency: (invoice.currency || "usd").toUpperCase(),
                payment_reference: `STRIPE-INV-${invoice.id}`,
                purpose: "business_subscription",
                stripe_invoice_id: invoice.id,
                provider_reference: invoice.id,
                paid_at: new Date().toISOString(),
                metadata: {
                  renewal: true,
                  stripe_subscription_id: subId,
                  stripe_customer_id: customerId,
                },
              })
              .select("id")
              .single();
            paymentId = created?.id ? String(created.id) : null;
            if (paymentId) {
              const now = new Date();
              const periodStart = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
              );
              const periodEnd = new Date(
                Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
              );
              await db().from("business_subscription_payments").upsert(
                {
                  payment_id: paymentId,
                  provider_id: plan.provider_id,
                  period_start: periodStart.toISOString().slice(0, 10),
                  period_end: periodEnd.toISOString().slice(0, 10),
                  renewal: true,
                  activated_at: new Date().toISOString(),
                  stripe_subscription_id: subId,
                  stripe_invoice_id: invoice.id,
                },
                { onConflict: "payment_id" },
              );
              await activateBusinessSubscriptionFromPayment({
                paymentId,
                actorUserId: "stripe_webhook",
                source: "webhook",
              });
              await snapshotPaymentStatus({
                paymentId,
                fromStatus: null,
                toStatus: "paid",
                source: "webhook",
                note: "invoice.paid_renewal",
              });
            }
          }
        } else if (paymentId) {
          await db()
            .from("payments")
            .update({ stripe_invoice_id: invoice.id })
            .eq("id", paymentId);
          await applyCanonicalPaymentEvent({
            paymentId,
            eventType: "subscription_renewed",
            actorId: "stripe_webhook",
            externalEventId: event.id,
            source: "webhook",
          });
        }

        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          paymentId,
          forceStatus: "processed",
        });
        return { ok: true, paymentId: paymentId ?? undefined };
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        if (subId) {
          const { data: plan } = await db()
            .from("provider_monetization_plans")
            .select("provider_id")
            .eq("stripe_subscription_id", subId)
            .maybeSingle();
          if (plan?.provider_id) {
            await db()
              .from("provider_monetization_plans")
              .update({
                status: "past_due",
                updated_at: new Date().toISOString(),
              })
              .eq("provider_id", plan.provider_id);
          }
        }
        const paymentId = await resolvePaymentIdFromStripe({
          invoiceId: invoice.id,
          metadataPaymentId: invoice.metadata?.dalily_payment_id,
        });
        if (paymentId) {
          await applyCanonicalPaymentEvent({
            paymentId,
            eventType: "payment_failed",
            actorId: "stripe_webhook",
            externalEventId: event.id,
            source: "webhook",
          });
        }
        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          paymentId,
          forceStatus: "processed",
        });
        return { ok: true, paymentId: paymentId ?? undefined };
      }

      case "charge.refunded":
      case "refund.updated": {
        let stripeRefundId: string | null = null;
        let paymentIntentId: string | null = null;
        let chargeId: string | null = null;
        let refundStatus: string | null = null;
        let metadataRefundId: string | null = null;

        if (event.type === "refund.updated") {
          const refund = event.data.object as Stripe.Refund;
          stripeRefundId = refund.id;
          refundStatus = refund.status;
          metadataRefundId = refund.metadata?.dalily_refund_id ?? null;
          paymentIntentId =
            typeof refund.payment_intent === "string"
              ? refund.payment_intent
              : refund.payment_intent?.id ?? null;
          chargeId =
            typeof refund.charge === "string"
              ? refund.charge
              : refund.charge?.id ?? null;
        } else {
          const charge = event.data.object as Stripe.Charge;
          chargeId = charge.id;
          paymentIntentId =
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id ?? null;
          const lastRefund = charge.refunds?.data?.[0];
          stripeRefundId = lastRefund?.id ?? null;
          refundStatus = lastRefund?.status ?? "succeeded";
          metadataRefundId = lastRefund?.metadata?.dalily_refund_id ?? null;
        }

        const refunds = await import("@/lib/refunds");
        let refundRow = metadataRefundId
          ? await refunds.getRefundById(metadataRefundId)
          : null;
        if (!refundRow && stripeRefundId) {
          refundRow = await refunds.findRefundByStripeId(stripeRefundId);
        }

        let paymentId =
          refundRow?.paymentId ??
          (await resolvePaymentIdFromStripe({
            paymentIntentId,
            metadataPaymentId: null,
          }));

        if (!paymentId && chargeId) {
          const { data: byCharge } = await db()
            .from("payments")
            .select("id")
            .eq("stripe_charge_id", chargeId)
            .maybeSingle();
          if (byCharge?.id) paymentId = String(byCharge.id);
        }

        if (!refundRow && paymentId) {
          refundRow = await refunds.findOpenRefundForPayment(paymentId);
        }

        if (refundRow) {
          if (refundStatus === "succeeded" || event.type === "charge.refunded") {
            await refunds.completeRefundSuccess({
              refundId: refundRow.id,
              actorUserId: null,
              source: "webhook",
              stripeRefundId,
            });
            await applyCanonicalPaymentEvent({
              paymentId: refundRow.paymentId,
              eventType: "refund_succeeded",
              actorId: "stripe_webhook",
              externalEventId: event.id,
              source: "webhook",
            });
          } else if (refundStatus === "failed" || refundStatus === "canceled") {
            await refunds.markRefundFailed({
              refundId: refundRow.id,
              note: `stripe:${refundStatus}`,
            });
            await applyCanonicalPaymentEvent({
              paymentId: refundRow.paymentId,
              eventType: "refund_failed",
              actorId: "stripe_webhook",
              externalEventId: event.id,
              source: "webhook",
            });
          }
        }

        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          paymentId: paymentId ?? refundRow?.paymentId ?? null,
          forceStatus: "processed",
        });
        return {
          ok: true,
          paymentId: paymentId ?? refundRow?.paymentId ?? undefined,
        };
      }

      case "charge.dispute.created":
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === "string"
            ? dispute.charge
            : dispute.charge?.id;
        let paymentId: string | null = null;
        let providerId: string | null = null;

        if (chargeId) {
          const { data: pay } = await db()
            .from("payments")
            .select("id, provider_id")
            .eq("stripe_charge_id", chargeId)
            .maybeSingle();
          if (pay) {
            paymentId = String(pay.id);
            providerId = String(pay.provider_id);
          }
        }
        if (!paymentId) {
          const pi =
            typeof dispute.payment_intent === "string"
              ? dispute.payment_intent
              : dispute.payment_intent?.id;
          if (pi) {
            paymentId = await resolvePaymentIdFromStripe({
              paymentIntentId: pi,
            });
            if (paymentId) {
              const { data: pay } = await db()
                .from("payments")
                .select("provider_id")
                .eq("id", paymentId)
                .maybeSingle();
              providerId = pay?.provider_id ? String(pay.provider_id) : null;
            }
          }
        }

        const { upsertDisputeFromStripe } = await import("@/lib/refunds");
        await upsertDisputeFromStripe({
          stripeDisputeId: dispute.id,
          stripeChargeId: chargeId,
          paymentId,
          providerId,
          status: dispute.status,
          reason: dispute.reason,
          amount: (dispute.amount ?? 0) / 100,
          currency: dispute.currency,
          evidenceDueBy: dispute.evidence_details?.due_by ?? null,
          resolution: dispute.status,
          closed: event.type === "charge.dispute.closed",
        });

        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          paymentId,
          forceStatus: "processed",
        });
        return { ok: true, paymentId: paymentId ?? undefined };
      }

      default: {
        await recordVerifiedPaymentEvent({
          provider: "stripe",
          externalEventId: event.id,
          eventType: event.type,
          forceStatus: "ignored",
          errorMessage: "unhandled_stripe_event",
        });
        return { ok: true };
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "stripe_webhook_failed";
    await recordVerifiedPaymentEvent({
      provider: "stripe",
      externalEventId: event.id,
      eventType: event.type,
      forceStatus: "failed",
      errorMessage: message,
    });
    return { ok: false, error: message, status: 500 };
  }
}
