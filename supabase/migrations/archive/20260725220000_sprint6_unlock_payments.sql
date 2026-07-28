-- Sprint 6 — Unlock Fee Payment Integration (additive)
-- Correlate payments.purpose=unlock_fee ↔ unlock_sessions.
-- No subscription table drops. Real capture remains manual-admin rail + webhook ledger.

-- Purpose + unlock link on payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'subscription';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_purpose_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_purpose_check
      CHECK (purpose IN ('subscription', 'unlock_fee'));
  END IF;
END $$;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS unlock_session_id uuid NULL
    REFERENCES public.unlock_sessions (id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS idempotency_key text NULL;

-- Backfill: rows with subscription stay subscription; orphan rows default already set
UPDATE public.payments
SET purpose = 'subscription'
WHERE purpose IS NULL OR purpose = '';

COMMENT ON COLUMN public.payments.purpose IS
  'subscription (legacy) | unlock_fee (Dalily 2.0 Sprint 6)';

COMMENT ON COLUMN public.payments.unlock_session_id IS
  'Set when purpose=unlock_fee. Capture correlates to contact_release_grants.';

-- At most one open or paid unlock payment per session (retry after reject/cancel/fail)
CREATE UNIQUE INDEX IF NOT EXISTS payments_unlock_session_active_uidx
  ON public.payments (unlock_session_id)
  WHERE unlock_session_id IS NOT NULL
    AND payment_status IN ('pending', 'pending_review', 'paid');

CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_uidx
  ON public.payments (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_purpose_status_idx
  ON public.payments (purpose, payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_unlock_session_idx
  ON public.payments (unlock_session_id)
  WHERE unlock_session_id IS NOT NULL;

-- Link back from unlock session (nullable until payment created)
ALTER TABLE public.unlock_sessions
  ADD COLUMN IF NOT EXISTS payment_id uuid NULL
    REFERENCES public.payments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS unlock_sessions_payment_id_idx
  ON public.unlock_sessions (payment_id)
  WHERE payment_id IS NOT NULL;

-- Webhook / verified-server-event ledger (idempotent retries)
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'manual',
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_status text NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  payment_id uuid NULL REFERENCES public.payments (id) ON DELETE SET NULL,
  error_message text NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  CONSTRAINT payment_webhook_events_provider_external_uidx
    UNIQUE (provider, external_event_id)
);

CREATE INDEX IF NOT EXISTS payment_webhook_events_payment_idx
  ON public.payment_webhook_events (payment_id, received_at DESC);

COMMENT ON TABLE public.payment_webhook_events IS
  'Idempotent ledger for payment webhooks and verified server-side capture events (Sprint 6).';

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_webhook_events_select_admin ON public.payment_webhook_events;
CREATE POLICY payment_webhook_events_select_admin ON public.payment_webhook_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
    )
  );
