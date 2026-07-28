-- AI Engine Phase 2 — Intent decisions cache + match explainability columns
-- Extends learning_events; additive only.

-- =============================================================================
-- LEARNING EVENTS (Phase 2 signals)
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
      -- Phase 2
      'urgency_corrected',
      'workflow_recommended',
      'workflow_overridden',
      'match_ranked',
      'match_accepted',
      'match_rejected',
      'question_answered',
      'intent_cached'
    )
  );

-- =============================================================================
-- AI INTENT DECISIONS (cached structured decisions — fast path)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_intent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_text TEXT NOT NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'und',
  decision JSONB NOT NULL,
  confidence NUMERIC(6, 4) NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 1),
  hit_count INTEGER NOT NULL DEFAULT 1 CHECK (hit_count >= 0),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_intent_decisions_norm_lang UNIQUE (normalized_text, language)
);

COMMENT ON TABLE public.ai_intent_decisions IS
  'Cached AI intent decisions for repeated phrases. No PII beyond scrubbed text.';

CREATE INDEX IF NOT EXISTS ai_intent_decisions_lookup_idx
  ON public.ai_intent_decisions (normalized_text, confidence DESC);

CREATE INDEX IF NOT EXISTS ai_intent_decisions_last_used_idx
  ON public.ai_intent_decisions (last_used_at DESC);

ALTER TABLE public.ai_intent_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_intent_decisions_select_admin" ON public.ai_intent_decisions;
CREATE POLICY "ai_intent_decisions_select_admin" ON public.ai_intent_decisions
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
-- MATCH ASSIGNMENTS — AI score + explanation (optional)
-- =============================================================================

ALTER TABLE public.match_assignments
  ADD COLUMN IF NOT EXISTS ai_match_score NUMERIC(5, 2)
    CHECK (ai_match_score IS NULL OR (ai_match_score >= 0 AND ai_match_score <= 100));

ALTER TABLE public.match_assignments
  ADD COLUMN IF NOT EXISTS ai_explanation JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.match_assignments.ai_match_score IS
  'AI Engine Phase 2 overall match score 0–100. Null when AI ranking off.';

COMMENT ON COLUMN public.match_assignments.ai_explanation IS
  'Human-readable explanation bullets for why this provider was ranked.';
