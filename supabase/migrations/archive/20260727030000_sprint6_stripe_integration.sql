-- Sprint 6 Phase 3 — Stripe Integration
-- Extends payment spine; no change to PaymentProvider contract.

-- Allow stripe as payment_provider enum value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'payment_provider' AND e.enumlabel = 'stripe'
  ) THEN
    ALTER TYPE public.payment_provider ADD VALUE 'stripe';
  END IF;
END $$;

-- Stripe references on payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_pi_uidx
  ON public.payments (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_cs_uidx
  ON public.payments (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- Business plan Stripe Billing fields
ALTER TABLE public.provider_monetization_plans
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renewal_cancelled_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS monetization_stripe_customer_uidx
  ON public.provider_monetization_plans (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS monetization_stripe_subscription_uidx
  ON public.provider_monetization_plans (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Link business subscription payments to Stripe invoice/subscription
ALTER TABLE public.business_subscription_payments
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- Webhook processing retry support (reuse payment_webhook_events)
ALTER TABLE public.payment_webhook_events
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_valid BOOLEAN;

COMMENT ON COLUMN public.payments.stripe_payment_intent_id IS
  'Sprint 6 Phase 3 — Stripe PaymentIntent id for lead unlocks.';
COMMENT ON COLUMN public.provider_monetization_plans.stripe_subscription_id IS
  'Sprint 6 Phase 3 — Stripe Billing subscription for Business plan.';
