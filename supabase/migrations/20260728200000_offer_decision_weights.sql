-- Sprint 10 Phase 2: configurable offer decision weights (optional overrides).
-- Defaults live in application code; this table enables ops tuning without deploys.
-- Weights are never exposed to customers via API.

CREATE TABLE IF NOT EXISTS public.offer_decision_weights (
  signal_key text PRIMARY KEY,
  category text NOT NULL DEFAULT 'general',
  weight numeric(8,4) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  ml_ready boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.offer_decision_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY offer_decision_weights_admin_all
  ON public.offer_decision_weights
  FOR ALL
  TO authenticated
  USING (public.has_role('admin'::public.app_role))
  WITH CHECK (public.has_role('admin'::public.app_role));

COMMENT ON TABLE public.offer_decision_weights IS
  'Sprint 10 Phase 2: optional overrides for offer ranking signal weights. Service role reads; customers never see rows.';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offer_decision_weights TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offer_decision_weights TO authenticated;
