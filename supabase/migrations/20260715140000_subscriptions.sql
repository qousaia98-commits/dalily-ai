-- Dalily AI — Subscriptions & payments (Sprint 7)

CREATE TYPE public.subscription_status AS ENUM (
  'trial',
  'active',
  'pending_payment',
  'expired',
  'cancelled'
);

CREATE TYPE public.payment_provider AS ENUM ('manual', 'shamcash', 'future');

CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'cancelled');

CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'paid', 'void');

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(40) NOT NULL UNIQUE,
  name JSONB NOT NULL,
  monthly_price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  yearly_price_usd NUMERIC(10, 2) NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans (id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscriptions_provider_id_idx ON public.subscriptions (provider_id);
CREATE INDEX subscriptions_status_idx ON public.subscriptions (status);
CREATE INDEX subscriptions_expires_at_idx ON public.subscriptions (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions (id) ON DELETE SET NULL,
  payment_provider public.payment_provider NOT NULL DEFAULT 'manual',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  external_transaction_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payments_provider_id_idx ON public.payments (provider_id);
CREATE INDEX payments_status_idx ON public.payments (payment_status);
CREATE INDEX payments_subscription_id_idx ON public.payments (subscription_id);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments (id) ON DELETE SET NULL,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  subtotal NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status public.invoice_status NOT NULL DEFAULT 'issued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX invoices_provider_id_idx ON public.invoices (provider_id);

CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed plans (FREE, PRO, PREMIUM)
INSERT INTO public.subscription_plans (slug, name, monthly_price_usd, yearly_price_usd, features) VALUES
(
  'free',
  '{"en": "Free", "ar": "مجاني"}',
  0,
  0,
  '{
    "maxServices": 5,
    "maxImages": 5,
    "searchVisible": true,
    "basicAnalytics": true,
    "verifiedBadge": false,
    "advancedAnalytics": false,
    "aiProfileOptimization": false,
    "priorityVerification": false,
    "featuredSection": false,
    "premiumBadge": false,
    "profileVideo": false,
    "customPage": false,
    "prioritySupport": false,
    "earlyAccess": false,
    "rankingBonus": 0
  }'
),
(
  'pro',
  '{"en": "Pro", "ar": "احترافي"}',
  13,
  130,
  '{
    "maxServices": null,
    "maxImages": 20,
    "searchVisible": true,
    "basicAnalytics": true,
    "verifiedBadge": true,
    "advancedAnalytics": true,
    "aiProfileOptimization": true,
    "priorityVerification": true,
    "featuredSection": false,
    "premiumBadge": false,
    "profileVideo": false,
    "customPage": false,
    "prioritySupport": false,
    "earlyAccess": false,
    "rankingBonus": 0.03
  }'
),
(
  'premium',
  '{"en": "Premium", "ar": "مميز"}',
  20,
  200,
  '{
    "maxServices": null,
    "maxImages": 20,
    "searchVisible": true,
    "basicAnalytics": true,
    "verifiedBadge": true,
    "advancedAnalytics": true,
    "aiProfileOptimization": true,
    "priorityVerification": true,
    "featuredSection": true,
    "premiumBadge": true,
    "profileVideo": true,
    "customPage": true,
    "prioritySupport": true,
    "earlyAccess": true,
    "rankingBonus": 0.05
  }'
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plans_public_read" ON public.subscription_plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = subscriptions.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = payments.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = invoices.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

-- Extend audit actions for subscription events
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_approved';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_rejected';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'subscription_extended';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'subscription_cancelled';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'subscription_plan_changed';
