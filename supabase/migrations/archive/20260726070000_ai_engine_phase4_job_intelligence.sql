-- AI Engine Phase 4 — Job Intelligence & Service Knowledge
-- Structured service knowledge + per-request job analyses for learning.

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
      'dispatch_planned',
      'dispatch_exposed',
      'capacity_skipped',
      'route_boosted',
      'response_predicted',
      'eta_predicted',
      'prediction_compared',
      'reputation_updated',
      -- Phase 4
      'job_analyzed',
      'job_prep_shown',
      'job_duration_compared',
      'job_materials_compared',
      'job_complexity_compared',
      'multi_service_detected'
    )
  );

-- =============================================================================
-- SERVICE KNOWLEDGE (structured trade intelligence)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_service_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key TEXT NOT NULL UNIQUE,
  category_slug TEXT NOT NULL,
  subcategory TEXT,
  typical_problems JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_causes JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  typical_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  common_materials JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_min_minutes INTEGER,
  duration_typical_minutes INTEGER,
  duration_max_minutes INTEGER,
  complexity VARCHAR(16) NOT NULL DEFAULT 'moderate'
    CHECK (complexity IN ('simple', 'moderate', 'complex')),
  emergency_capable BOOLEAN NOT NULL DEFAULT false,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  price_min NUMERIC(12, 2),
  price_typical NUMERIC(12, 2),
  price_max NUMERIC(12, 2),
  price_currency VARCHAR(8) NOT NULL DEFAULT 'SYP',
  related_trades JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sample_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_service_knowledge IS
  'Structured service/job knowledge. Seeded + improved by post-job learning.';

CREATE INDEX IF NOT EXISTS ai_service_knowledge_category_idx
  ON public.ai_service_knowledge (category_slug);

ALTER TABLE public.ai_service_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_service_knowledge_select_authenticated" ON public.ai_service_knowledge;
CREATE POLICY "ai_service_knowledge_select_authenticated" ON public.ai_service_knowledge
  FOR SELECT
  TO authenticated
  USING (true);

-- Writes via service role only.

-- =============================================================================
-- JOB ANALYSES (per request — append learning comparisons later)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_job_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES public.service_requests (id) ON DELETE SET NULL,
  booking_id UUID,
  service_key TEXT,
  category_slug TEXT,
  analysis JSONB NOT NULL,
  confidence NUMERIC(6, 4)
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Continuous learning fields
  actual_duration_minutes INTEGER,
  actual_materials JSONB,
  actual_complexity VARCHAR(16),
  compared_at TIMESTAMPTZ
);

COMMENT ON TABLE public.ai_job_analyses IS
  'Per-request job intelligence snapshot + post-completion learning deltas.';

CREATE INDEX IF NOT EXISTS ai_job_analyses_request_idx
  ON public.ai_job_analyses (service_request_id)
  WHERE service_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_job_analyses_uncompared_idx
  ON public.ai_job_analyses (created_at DESC)
  WHERE compared_at IS NULL;

ALTER TABLE public.ai_job_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_job_analyses_select_admin" ON public.ai_job_analyses;
CREATE POLICY "ai_job_analyses_select_admin" ON public.ai_job_analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );

-- Provider may read analyses for requests they were assigned to.
DROP POLICY IF EXISTS "ai_job_analyses_select_assigned_provider" ON public.ai_job_analyses;
CREATE POLICY "ai_job_analyses_select_assigned_provider" ON public.ai_job_analyses
  FOR SELECT
  USING (
    service_request_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.match_assignments ma
      JOIN public.providers p ON p.id = ma.provider_id
      WHERE ma.service_request_id = ai_job_analyses.service_request_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );
