-- Sprint 5 — Unlock Service (additive)
-- Unlock sessions + contact release grants. No subscription table changes.
-- Payment capture correlation is Sprint 6; Sprint 5 stores fee snapshot + SLA only.

CREATE TABLE IF NOT EXISTS public.unlock_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid NOT NULL REFERENCES public.marketplace_selections (id) ON DELETE CASCADE,
  service_request_id uuid NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  offer_id uuid NULL REFERENCES public.marketplace_offers (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'opened'
    CHECK (status IN ('opened', 'payment_pending', 'succeeded', 'declined', 'timed_out')),
  fee_amount numeric(12, 2) NOT NULL,
  fee_currency text NOT NULL DEFAULT 'SYP',
  sla_deadline timestamptz NOT NULL,
  fallback_applied boolean NOT NULL DEFAULT false,
  idempotency_key text NOT NULL,
  payment_stub_ref text NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz NULL,
  CONSTRAINT unlock_sessions_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT unlock_sessions_one_open_per_selection UNIQUE (selection_id)
);

CREATE INDEX IF NOT EXISTS unlock_sessions_provider_status_idx
  ON public.unlock_sessions (provider_id, status, sla_deadline);

CREATE INDEX IF NOT EXISTS unlock_sessions_sla_idx
  ON public.unlock_sessions (status, sla_deadline)
  WHERE status IN ('opened', 'payment_pending');

CREATE INDEX IF NOT EXISTS unlock_sessions_request_idx
  ON public.unlock_sessions (service_request_id, opened_at DESC);

COMMENT ON TABLE public.unlock_sessions IS
  'Dalily 2.0 Unlock Service — SLA + fee snapshot per selection (Sprint 5).';

CREATE TABLE IF NOT EXISTS public.contact_release_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_session_id uuid NOT NULL REFERENCES public.unlock_sessions (id) ON DELETE CASCADE,
  service_request_id uuid NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  scope jsonb NOT NULL DEFAULT '["phone","whatsapp","address","chat"]'::jsonb,
  granted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_release_grants_one_per_session UNIQUE (unlock_session_id),
  CONSTRAINT contact_release_grants_one_active_per_request UNIQUE (service_request_id)
);

CREATE INDEX IF NOT EXISTS contact_release_grants_customer_idx
  ON public.contact_release_grants (customer_id, granted_at DESC);

COMMENT ON TABLE public.contact_release_grants IS
  'Contact/PII release only after unlock success. Checked by Chat in Sprint 7.';

CREATE TABLE IF NOT EXISTS public.unlock_reliability_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_session_id uuid NOT NULL REFERENCES public.unlock_sessions (id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (signal_type IN ('declined', 'timed_out')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS unlock_reliability_signals_provider_idx
  ON public.unlock_reliability_signals (provider_id, created_at DESC);

COMMENT ON TABLE public.unlock_reliability_signals IS
  'Hook for future reputation (Sprint 5). No scoring compute here.';

ALTER TABLE public.unlock_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_release_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unlock_reliability_signals ENABLE ROW LEVEL SECURITY;

-- Sessions: customer of request, owning provider, admin
DROP POLICY IF EXISTS unlock_sessions_select ON public.unlock_sessions;
CREATE POLICY unlock_sessions_select ON public.unlock_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = unlock_sessions.service_request_id
        AND sr.customer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = unlock_sessions.provider_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS contact_release_grants_select ON public.contact_release_grants;
CREATE POLICY contact_release_grants_select ON public.contact_release_grants
  FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = contact_release_grants.provider_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
    )
  );

-- Reliability signals: provider owner + admin read
DROP POLICY IF EXISTS unlock_reliability_signals_select ON public.unlock_reliability_signals;
CREATE POLICY unlock_reliability_signals_select ON public.unlock_reliability_signals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = unlock_reliability_signals.provider_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
    )
  );
