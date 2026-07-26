-- AI Engine Phase 5 — Vision Intelligence
-- Cached image analyses + customer confirmation + learning fields.

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
      'job_analyzed',
      'job_prep_shown',
      'job_duration_compared',
      'job_materials_compared',
      'job_complexity_compared',
      'multi_service_detected',
      -- Phase 5
      'vision_analyzed',
      'vision_cached',
      'vision_confirmed',
      'vision_corrected',
      'vision_fused',
      'vision_contradiction',
      'vision_damage_compared',
      'vision_tools_compared',
      'vision_materials_compared'
    )
  );

CREATE TABLE IF NOT EXISTS public.ai_vision_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Content fingerprint to avoid duplicate Vision API calls
  content_hash TEXT NOT NULL,
  service_request_id UUID REFERENCES public.service_requests (id) ON DELETE SET NULL,
  image_path TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  analysis JSONB NOT NULL,
  fusion JSONB,
  customer_summary_en TEXT,
  customer_summary_ar TEXT,
  customer_confirmed BOOLEAN,
  customer_correction TEXT,
  confidence NUMERIC(6, 4)
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Learning
  actual_damage JSONB,
  actual_tools JSONB,
  actual_materials JSONB,
  compared_at TIMESTAMPTZ,
  CONSTRAINT ai_vision_analyses_hash_unique UNIQUE (content_hash)
);

COMMENT ON TABLE public.ai_vision_analyses IS
  'Cached Vision Intelligence analyses. Hash-deduped to skip duplicate API calls.';

CREATE INDEX IF NOT EXISTS ai_vision_analyses_request_idx
  ON public.ai_vision_analyses (service_request_id)
  WHERE service_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_vision_analyses_uncompared_idx
  ON public.ai_vision_analyses (created_at DESC)
  WHERE compared_at IS NULL;

ALTER TABLE public.ai_vision_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_vision_analyses_select_admin" ON public.ai_vision_analyses;
CREATE POLICY "ai_vision_analyses_select_admin" ON public.ai_vision_analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "ai_vision_analyses_select_assigned_provider" ON public.ai_vision_analyses;
CREATE POLICY "ai_vision_analyses_select_assigned_provider" ON public.ai_vision_analyses
  FOR SELECT
  USING (
    service_request_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.match_assignments ma
      JOIN public.providers p ON p.id = ma.provider_id
      WHERE ma.service_request_id = ai_vision_analyses.service_request_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

-- Authenticated customers can insert/select their own pre-publish analyses (no request yet)
-- via service role in app; no broad insert policy.
