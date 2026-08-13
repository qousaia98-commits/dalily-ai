-- AI Foundation Phase 1 — Memory + Knowledge Base + Learning event expansion
-- Append-only memory; knowledge phrases update aggregates only (never erase history).
-- Privacy: no phone/email/exact GPS in AI tables — scrubbed phrase text only.

-- =============================================================================
-- EXTEND learning_events CHECK (intent / matching / AI signals)
-- =============================================================================

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_type_chk;

ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_type_chk CHECK (
    event_type IN (
      -- Sprint 29 marketplace signals
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
      -- AI Foundation Phase 1
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
      'memory_recorded'
    )
  );

COMMENT ON CONSTRAINT learning_events_type_chk ON public.learning_events IS
  'Append-only learning event vocabulary (Sprint 29 + AI Foundation Phase 1).';

-- =============================================================================
-- AI INTENT MEMORY (append-only per interaction snapshot)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_intent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Soft link only — memory survives request deletion as anonymized learning.
  service_request_id UUID REFERENCES public.service_requests (id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  -- Scrubbed / truncated original text (no phone/email).
  original_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  language VARCHAR(8),
  dialect VARCHAR(32),
  detected_category_slug TEXT,
  detected_subcategory TEXT,
  confidence NUMERIC(6, 4)
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  questions_asked JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_category_slug TEXT,
  final_category_id UUID REFERENCES public.categories (id) ON DELETE SET NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('knowledge', 'rules', 'llm', 'user', 'hybrid', 'unknown')),
  was_corrected BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_intent_memory IS
  'Append-only AI memory of intent interactions. Never UPDATE historical rows — always INSERT.';

CREATE INDEX IF NOT EXISTS ai_intent_memory_created_idx
  ON public.ai_intent_memory (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_intent_memory_normalized_idx
  ON public.ai_intent_memory (normalized_text);

CREATE INDEX IF NOT EXISTS ai_intent_memory_category_idx
  ON public.ai_intent_memory (final_category_slug)
  WHERE final_category_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_intent_memory_request_idx
  ON public.ai_intent_memory (service_request_id)
  WHERE service_request_id IS NOT NULL;

ALTER TABLE public.ai_intent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_intent_memory_select_admin" ON public.ai_intent_memory;
CREATE POLICY "ai_intent_memory_select_admin" ON public.ai_intent_memory
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );

-- Writes via service role only (no INSERT policy for authenticated).

-- =============================================================================
-- AI KNOWLEDGE PHRASES (Dalily structured intelligence)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_knowledge_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase TEXT NOT NULL,
  normalized_phrase TEXT NOT NULL,
  category_slug TEXT NOT NULL,
  subcategory TEXT,
  language VARCHAR(8) NOT NULL DEFAULT 'und',
  dialect VARCHAR(32),
  confidence NUMERIC(6, 4) NOT NULL DEFAULT 0.5000
    CHECK (confidence >= 0 AND confidence <= 1),
  occurrences INTEGER NOT NULL DEFAULT 1
    CHECK (occurrences >= 0),
  confirmations INTEGER NOT NULL DEFAULT 0
    CHECK (confirmations >= 0),
  corrections INTEGER NOT NULL DEFAULT 0
    CHECK (corrections >= 0),
  success_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.5000
    CHECK (success_rate >= 0 AND success_rate <= 1),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ai_knowledge_phrases_unique
    UNIQUE (normalized_phrase, category_slug, language)
);

COMMENT ON TABLE public.ai_knowledge_phrases IS
  'Structured phrase→category knowledge. Aggregates only — no PII. Fast path before LLM.';

CREATE INDEX IF NOT EXISTS ai_knowledge_phrases_lookup_idx
  ON public.ai_knowledge_phrases (normalized_phrase, confidence DESC);

CREATE INDEX IF NOT EXISTS ai_knowledge_phrases_category_idx
  ON public.ai_knowledge_phrases (category_slug, success_rate DESC);

CREATE INDEX IF NOT EXISTS ai_knowledge_phrases_last_used_idx
  ON public.ai_knowledge_phrases (last_used_at DESC);

ALTER TABLE public.ai_knowledge_phrases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_knowledge_phrases_select_admin" ON public.ai_knowledge_phrases;
CREATE POLICY "ai_knowledge_phrases_select_admin" ON public.ai_knowledge_phrases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );

-- Writes via service role only.
