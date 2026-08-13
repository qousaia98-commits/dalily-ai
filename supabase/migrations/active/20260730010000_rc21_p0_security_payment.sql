-- RC2.1 P0 — Critical security & payment hardening (Closed Beta gate)
-- Atomic wallet ledger RPC, finance/support roles, financial audit log, RLS updates.
--
-- PostgreSQL 55P04: a newly added ENUM label cannot be referenced in the same
-- transaction that created it. Commit after ADD VALUE so later policies may
-- safely use 'finance'::public.app_role / 'support'::public.app_role.

-- ── Roles (must commit before any use of the new labels) ───────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';

-- End the migration's wrapping transaction so new enum values become usable.
-- Subsequent statements run in a fresh transaction (Supabase CLI / psql).
COMMIT;

-- ── Financial audit (append-only) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_roles text[] NOT NULL DEFAULT '{}',
  action text NOT NULL,
  object_type text NOT NULL,
  object_id text NOT NULL,
  old_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL CHECK (result = ANY (ARRAY['success'::text, 'failure'::text, 'rejected'::text])),
  correlation_id text,
  ip text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS financial_audit_logs_created_idx
  ON public.financial_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS financial_audit_logs_object_idx
  ON public.financial_audit_logs (object_type, object_id);
CREATE INDEX IF NOT EXISTS financial_audit_logs_actor_idx
  ON public.financial_audit_logs (actor_id, created_at DESC);

ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_audit_select_finance ON public.financial_audit_logs;
CREATE POLICY financial_audit_select_finance ON public.financial_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin'::public.app_role)
    OR public.has_role('finance'::public.app_role)
  );

-- No UPDATE/DELETE policies for authenticated — immutability via RLS denial.
REVOKE UPDATE, DELETE ON public.financial_audit_logs FROM authenticated, anon;
GRANT SELECT ON public.financial_audit_logs TO authenticated;
GRANT ALL ON public.financial_audit_logs TO service_role;

-- ── Wallet atomic ledger RPC ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_wallet_ledger_entry(
  p_user_id uuid,
  p_entry_type text,
  p_amount numeric,
  p_currency text DEFAULT 'SYP',
  p_idempotency_key text DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL,
  p_escrow_id uuid DEFAULT NULL,
  p_payout_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_available numeric(14,2);
  v_reserved numeric(14,2);
  v_pending numeric(14,2);
  v_refund numeric(14,2);
  v_bonus numeric(14,2);
  v_existing public.wallet_ledger%ROWTYPE;
  v_currency text := COALESCE(NULLIF(trim(p_currency), ''), 'SYP');
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_user');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount != p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;
  IF p_entry_type IS NULL OR p_entry_type NOT IN (
    'credit', 'debit', 'reserve', 'release', 'refund', 'payout', 'bonus', 'fee', 'adjustment'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_entry');
  END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'idempotency_required');
  END IF;

  -- Ensure wallet exists
  INSERT INTO public.wallets (user_id, currency)
  VALUES (p_user_id, v_currency)
  ON CONFLICT (user_id, currency) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id AND currency = v_currency
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wallet_unavailable');
  END IF;

  IF v_wallet.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wallet_frozen');
  END IF;

  -- Idempotent replay
  SELECT * INTO v_existing
  FROM public.wallet_ledger
  WHERE wallet_id = v_wallet.id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'wallet', jsonb_build_object(
        'walletId', v_wallet.id,
        'userId', v_wallet.user_id,
        'currency', v_wallet.currency,
        'available', v_wallet.available_balance,
        'reserved', v_wallet.reserved_balance,
        'pendingPayout', v_wallet.pending_payout_balance,
        'refund', v_wallet.refund_balance,
        'bonus', v_wallet.bonus_balance,
        'status', v_wallet.status
      )
    );
  END IF;

  v_available := v_wallet.available_balance;
  v_reserved := v_wallet.reserved_balance;
  v_pending := v_wallet.pending_payout_balance;
  v_refund := v_wallet.refund_balance;
  v_bonus := v_wallet.bonus_balance;

  IF p_entry_type IN ('credit', 'bonus', 'refund') THEN
    v_available := v_available + p_amount;
    IF p_entry_type = 'refund' THEN v_refund := v_refund + p_amount; END IF;
    IF p_entry_type = 'bonus' THEN v_bonus := v_bonus + p_amount; END IF;
  ELSIF p_entry_type IN ('debit', 'fee', 'payout') THEN
    IF v_available < p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_funds');
    END IF;
    v_available := v_available - p_amount;
    IF p_entry_type = 'payout' THEN v_pending := v_pending + p_amount; END IF;
  ELSIF p_entry_type = 'reserve' THEN
    IF v_available < p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_funds');
    END IF;
    v_available := v_available - p_amount;
    v_reserved := v_reserved + p_amount;
  ELSIF p_entry_type = 'release' THEN
    IF v_reserved < p_amount THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_reserved');
    END IF;
    v_reserved := v_reserved - p_amount;
  ELSIF p_entry_type = 'adjustment' THEN
    v_available := v_available + p_amount;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_entry');
  END IF;

  IF v_available < 0 OR v_reserved < 0 OR v_pending < 0 OR v_refund < 0 OR v_bonus < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'balance_invariant');
  END IF;

  INSERT INTO public.wallet_ledger (
    wallet_id, user_id, entry_type, amount, currency, balance_after,
    payment_id, escrow_id, payout_id, idempotency_key, description
  ) VALUES (
    v_wallet.id, p_user_id, p_entry_type, p_amount, v_wallet.currency, v_available,
    p_payment_id, p_escrow_id, p_payout_id, p_idempotency_key, p_description
  );

  UPDATE public.wallets SET
    available_balance = v_available,
    reserved_balance = v_reserved,
    pending_payout_balance = v_pending,
    refund_balance = v_refund,
    bonus_balance = v_bonus,
    updated_at = now()
  WHERE id = v_wallet.id;

  SELECT * INTO v_wallet FROM public.wallets WHERE id = v_wallet.id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'wallet', jsonb_build_object(
      'walletId', v_wallet.id,
      'userId', v_wallet.user_id,
      'currency', v_wallet.currency,
      'available', v_wallet.available_balance,
      'reserved', v_wallet.reserved_balance,
      'pendingPayout', v_wallet.pending_payout_balance,
      'refund', v_wallet.refund_balance,
      'bonus', v_wallet.bonus_balance,
      'status', v_wallet.status
    )
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Concurrent idempotent insert — return current wallet
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_user_id AND currency = v_currency;
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'wallet', jsonb_build_object(
        'walletId', v_wallet.id,
        'userId', v_wallet.user_id,
        'currency', v_wallet.currency,
        'available', v_wallet.available_balance,
        'reserved', v_wallet.reserved_balance,
        'pendingPayout', v_wallet.pending_payout_balance,
        'refund', v_wallet.refund_balance,
        'bonus', v_wallet.bonus_balance,
        'status', v_wallet.status
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_wallet_ledger_entry(
  uuid, text, numeric, text, text, uuid, uuid, uuid, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_wallet_ledger_entry(
  uuid, text, numeric, text, text, uuid, uuid, uuid, text
) TO service_role;

-- ── RLS: finance role may read financial tables ────────────────────────────
DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_own ON public.wallets
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role('admin'::public.app_role)
    OR public.has_role('finance'::public.app_role)
  );

DROP POLICY IF EXISTS wallet_ledger_select_own ON public.wallet_ledger;
CREATE POLICY wallet_ledger_select_own ON public.wallet_ledger
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role('admin'::public.app_role)
    OR public.has_role('finance'::public.app_role)
  );

DROP POLICY IF EXISTS escrow_holds_select_parties ON public.escrow_holds;
CREATE POLICY escrow_holds_select_parties ON public.escrow_holds
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.has_role('admin'::public.app_role)
    OR public.has_role('finance'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = escrow_holds.provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payouts_select_own ON public.payouts;
CREATE POLICY payouts_select_own ON public.payouts
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.has_role('admin'::public.app_role)
    OR public.has_role('finance'::public.app_role)
  );
