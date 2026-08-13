-- Sprint 10 Phase 4: Enterprise Payment & Wallet Platform
-- Wallets, ledger, escrow, payouts, fee rules. Extends payments purposes.

-- Expand payment_status enum for escrow / capture lifecycle (additive, non-breaking)
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'authorized';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'captured';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'reserved';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'released';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'refunded';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'partially_refunded';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'disputed';

-- Expand payments.purpose for escrow / payout / marketplace job / fee
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_purpose_check CHECK (
    purpose = ANY (ARRAY[
      'subscription'::text,
      'business_subscription'::text,
      'unlock_fee'::text,
      'lead_unlock'::text,
      'refund'::text,
      'credit'::text,
      'wallet'::text,
      'invoice'::text,
      'escrow'::text,
      'payout'::text,
      'marketplace_job'::text,
      'fee'::text
    ])
  );

-- User wallets (one per user)
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'SYP',
  available_balance numeric(14,2) NOT NULL DEFAULT 0,
  reserved_balance numeric(14,2) NOT NULL DEFAULT 0,
  pending_payout_balance numeric(14,2) NOT NULL DEFAULT 0,
  refund_balance numeric(14,2) NOT NULL DEFAULT 0,
  bonus_balance numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status = ANY (ARRAY['active'::text, 'frozen'::text, 'closed'::text])),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallets_user_currency_unique UNIQUE (user_id, currency),
  CONSTRAINT wallets_balances_nonneg CHECK (
    available_balance >= 0
    AND reserved_balance >= 0
    AND pending_payout_balance >= 0
    AND refund_balance >= 0
    AND bonus_balance >= 0
  )
);

CREATE INDEX IF NOT EXISTS wallets_user_idx ON public.wallets (user_id);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin'::public.app_role));

-- Append-only wallet ledger
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type text NOT NULL
    CHECK (entry_type = ANY (ARRAY[
      'credit'::text, 'debit'::text, 'reserve'::text, 'release'::text,
      'refund'::text, 'payout'::text, 'bonus'::text, 'fee'::text, 'adjustment'::text
    ])),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SYP',
  balance_after numeric(14,2),
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  escrow_id uuid,
  payout_id uuid,
  idempotency_key text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_ledger_idempotency UNIQUE (wallet_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS wallet_ledger_wallet_idx
  ON public.wallet_ledger (wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wallet_ledger_user_idx
  ON public.wallet_ledger (user_id, created_at DESC);

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_ledger_select_own ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin'::public.app_role));

-- Escrow holds for marketplace jobs
CREATE TABLE IF NOT EXISTS public.escrow_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  service_request_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL,
  booking_id uuid,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SYP',
  platform_fee numeric(14,2) NOT NULL DEFAULT 0,
  provider_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending'::text, 'reserved'::text, 'released'::text, 'refunded'::text,
      'partially_refunded'::text, 'disputed'::text, 'cancelled'::text, 'expired'::text
    ])),
  reserved_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  disputed_at timestamptz,
  idempotency_key text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS escrow_holds_customer_idx ON public.escrow_holds (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS escrow_holds_provider_idx ON public.escrow_holds (provider_id, status);
CREATE INDEX IF NOT EXISTS escrow_holds_request_idx ON public.escrow_holds (service_request_id);

ALTER TABLE public.escrow_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY escrow_holds_select_parties ON public.escrow_holds
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.has_role('admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = escrow_holds.provider_id AND p.owner_id = auth.uid()
    )
  );

ALTER TABLE public.wallet_ledger
  DROP CONSTRAINT IF EXISTS wallet_ledger_escrow_id_fkey;
ALTER TABLE public.wallet_ledger
  ADD CONSTRAINT wallet_ledger_escrow_id_fkey
  FOREIGN KEY (escrow_id) REFERENCES public.escrow_holds(id) ON DELETE SET NULL;

-- Provider payouts
CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SYP',
  method text NOT NULL DEFAULT 'wallet'
    CHECK (method = ANY (ARRAY['wallet'::text, 'bank'::text, 'stripe'::text, 'manual'::text])),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status = ANY (ARRAY[
      'pending'::text, 'scheduled'::text, 'processing'::text, 'paid'::text,
      'failed'::text, 'cancelled'::text, 'retrying'::text
    ])),
  escrow_id uuid REFERENCES public.escrow_holds(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  destination_ref text,
  failure_reason text,
  scheduled_at timestamptz,
  processed_at timestamptz,
  idempotency_key text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payouts_provider_idx ON public.payouts (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payouts_status_idx ON public.payouts (status, scheduled_at);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY payouts_select_own ON public.payouts
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.has_role('admin'::public.app_role)
  );

ALTER TABLE public.wallet_ledger
  DROP CONSTRAINT IF EXISTS wallet_ledger_payout_id_fkey;
ALTER TABLE public.wallet_ledger
  ADD CONSTRAINT wallet_ledger_payout_id_fkey
  FOREIGN KEY (payout_id) REFERENCES public.payouts(id) ON DELETE SET NULL;

-- Configurable fee rules (no hardcoded weights in UI)
CREATE TABLE IF NOT EXISTS public.payment_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  fee_type text NOT NULL
    CHECK (fee_type = ANY (ARRAY[
      'platform'::text, 'provider'::text, 'customer'::text, 'tax'::text, 'promotion'::text
    ])),
  calculation text NOT NULL DEFAULT 'percent'
    CHECK (calculation = ANY (ARRAY['percent'::text, 'fixed'::text, 'hybrid'::text])),
  percent_bps integer NOT NULL DEFAULT 0 CHECK (percent_bps >= 0 AND percent_bps <= 10000),
  fixed_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'SYP',
  country_code text,
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_fee_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_fee_rules_admin ON public.payment_fee_rules
  FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role))
  WITH CHECK (public.has_role('admin'::public.app_role));

CREATE POLICY payment_fee_rules_select_auth ON public.payment_fee_rules
  FOR SELECT TO authenticated
  USING (enabled = true OR public.has_role('admin'::public.app_role));

INSERT INTO public.payment_fee_rules (code, name, fee_type, calculation, percent_bps, fixed_amount)
VALUES
  ('platform_default', 'Platform fee', 'platform', 'percent', 1000, 0),
  ('tax_placeholder', 'Tax (disabled)', 'tax', 'percent', 0, 0)
ON CONFLICT (code) DO NOTHING;

-- Marketplace payment disputes (extends Stripe disputes conceptually)
CREATE TABLE IF NOT EXISTS public.marketplace_payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id uuid REFERENCES public.escrow_holds(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  opened_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status = ANY (ARRAY[
      'open'::text, 'investigating'::text, 'resolved'::text, 'refunded'::text,
      'released'::text, 'cancelled'::text
    ])),
  reason_code text NOT NULL,
  details text,
  resolution_note text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_payment_disputes_status_idx
  ON public.marketplace_payment_disputes (status, created_at DESC);

ALTER TABLE public.marketplace_payment_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY marketplace_disputes_select ON public.marketplace_payment_disputes
  FOR SELECT TO authenticated
  USING (
    opened_by = auth.uid()
    OR public.has_role('admin'::public.app_role)
  );

CREATE POLICY marketplace_disputes_insert ON public.marketplace_payment_disputes
  FOR INSERT TO authenticated
  WITH CHECK (opened_by = auth.uid());

CREATE POLICY marketplace_disputes_admin_update ON public.marketplace_payment_disputes
  FOR UPDATE TO authenticated
  USING (public.has_role('admin'::public.app_role))
  WITH CHECK (public.has_role('admin'::public.app_role));

GRANT ALL ON TABLE public.wallets TO authenticated, service_role;
GRANT ALL ON TABLE public.wallet_ledger TO authenticated, service_role;
GRANT ALL ON TABLE public.escrow_holds TO authenticated, service_role;
GRANT ALL ON TABLE public.payouts TO authenticated, service_role;
GRANT ALL ON TABLE public.payment_fee_rules TO authenticated, service_role;
GRANT ALL ON TABLE public.marketplace_payment_disputes TO authenticated, service_role;

COMMENT ON TABLE public.wallets IS 'Sprint 10 Phase 4: per-user wallet balances.';
COMMENT ON TABLE public.escrow_holds IS 'Sprint 10 Phase 4: marketplace escrow reservations.';
COMMENT ON TABLE public.payouts IS 'Sprint 10 Phase 4: provider payouts.';
COMMENT ON TABLE public.payment_fee_rules IS 'Sprint 10 Phase 4: configurable fee rules (ops-tunable).';
