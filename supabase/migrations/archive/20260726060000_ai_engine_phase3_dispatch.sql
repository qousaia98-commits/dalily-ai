-- AI Engine Phase 3 — Smart Dispatch & Provider Intelligence
-- Additive: predictions store, reputation cache, assignment dispatch fields.

-- =============================================================================
-- LEARNING EVENTS (Phase 3 operational signals)
-- =============================================================================

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_type_chk;

ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_type_chk CHECK (
    event_type IN (
      'provider_viewed',
      'provider_clicked',
      'request_started',
      'request_sent',
      'request_accepted',
      'request_declined',
      'provider_no_response',
      'request_completed',
      'customer_cancelled',
      'provider_cancelled',
      'review_submitted',
      'repeat_booking',
      'recommendation_shown',
      'recommendation_chosen',
      'diagnosis_completed',
      'diagnosis_abandoned',
      'intent_suggested',
      'intent_confirmed',
      'intent_corrected',
      'category_changed',
      'knowledge_hit',
      'knowledge_miss',
      'llm_invoked',
      'provider_accepted',
      'provider_declined',
      'job_completed',
      'memory_recorded',
      'urgency_corrected',
      'workflow_recommended',
      'workflow_overridden',
      'match_ranked',
      'match_accepted',
      'match_rejected',
      'question_answered',
      'intent_cached',
      -- Phase 3
      'dispatch_planned',
      'dispatch_exposed',
      'capacity_skipped',
      'route_boosted',
      'response_predicted',
      'eta_predicted',
      'prediction_compared',
      'reputation_updated'
    )
  );

-- =============================================================================
-- AI DISPATCH PREDICTIONS (compare later vs actuals)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_dispatch_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES public.service_requests (id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.providers (id) ON DELETE SET NULL,
  match_assignment_id UUID REFERENCES public.match_assignments (id) ON DELETE SET NULL,
  exposure_mode VARCHAR(32) NOT NULL DEFAULT 'limited_pool',
  response_band VARCHAR(16) NOT NULL DEFAULT 'medium',
  response_probability NUMERIC(6, 4)
    CHECK (response_probability IS NULL OR (response_probability >= 0 AND response_probability <= 1)),
  eta_minutes_min INTEGER,
  eta_minutes_max INTEGER,
  eta_label TEXT,
  predicted_duration_minutes INTEGER,
  operational_score NUMERIC(5, 2),
  reputation_score NUMERIC(5, 2),
  distance_km NUMERIC(8, 3),
  capacity_remaining_minutes INTEGER,
  route_fit BOOLEAN NOT NULL DEFAULT false,
  predicted_rank INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Filled by continuous learning after outcomes
  actual_responded_at TIMESTAMPTZ,
  actual_accepted BOOLEAN,
  actual_arrived_at TIMESTAMPTZ,
  actual_duration_minutes INTEGER,
  actual_customer_chose BOOLEAN,
  compared_at TIMESTAMPTZ
);

COMMENT ON TABLE public.ai_dispatch_predictions IS
  'Phase 3 dispatch predictions for continuous learning. No exact live GPS stored.';

CREATE INDEX IF NOT EXISTS ai_dispatch_predictions_request_idx
  ON public.ai_dispatch_predictions (service_request_id)
  WHERE service_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_dispatch_predictions_provider_idx
  ON public.ai_dispatch_predictions (provider_id, created_at DESC)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_dispatch_predictions_uncompared_idx
  ON public.ai_dispatch_predictions (created_at DESC)
  WHERE compared_at IS NULL;

ALTER TABLE public.ai_dispatch_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_dispatch_predictions_select_admin" ON public.ai_dispatch_predictions;
CREATE POLICY "ai_dispatch_predictions_select_admin" ON public.ai_dispatch_predictions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );

-- =============================================================================
-- AI PROVIDER REPUTATION (derived cache)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_provider_reputation (
  provider_id UUID PRIMARY KEY REFERENCES public.providers (id) ON DELETE CASCADE,
  reputation_score NUMERIC(5, 2) NOT NULL DEFAULT 50
    CHECK (reputation_score >= 0 AND reputation_score <= 100),
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_size INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_provider_reputation IS
  'Dynamic reputation 0–100. One ranking factor among many — never sole dispatch criterion.';

ALTER TABLE public.ai_provider_reputation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_provider_reputation_select_admin" ON public.ai_provider_reputation;
CREATE POLICY "ai_provider_reputation_select_admin" ON public.ai_provider_reputation
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "ai_provider_reputation_select_owner" ON public.ai_provider_reputation;
CREATE POLICY "ai_provider_reputation_select_owner" ON public.ai_provider_reputation
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

-- =============================================================================
-- MATCH ASSIGNMENTS — dispatch intelligence columns
-- =============================================================================

ALTER TABLE public.match_assignments
  ADD COLUMN IF NOT EXISTS exposure_mode VARCHAR(32);

ALTER TABLE public.match_assignments
  ADD COLUMN IF NOT EXISTS response_band VARCHAR(16);

ALTER TABLE public.match_assignments
  ADD COLUMN IF NOT EXISTS response_probability NUMERIC(6, 4);

ALTER TABLE public.match_assignments
  ADD COLUMN IF NOT EXISTS eta_label TEXT;

ALTER TABLE public.match_assignments
  ADD COLUMN IF NOT EXISTS operational_score NUMERIC(5, 2);

ALTER TABLE public.match_assignments
  ADD COLUMN IF NOT EXISTS reputation_score NUMERIC(5, 2);

COMMENT ON COLUMN public.match_assignments.exposure_mode IS
  'Phase 3 marketplace exposure mode for this assignment.';
COMMENT ON COLUMN public.match_assignments.operational_score IS
  'Phase 3 combined operational dispatch score 0–100.';
