-- AI Engine Phase 7 — Personal AI Assistant & Continuous Intelligence

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
      'vision_analyzed',
      'vision_cached',
      'vision_confirmed',
      'vision_corrected',
      'vision_fused',
      'vision_contradiction',
      'vision_damage_compared',
      'vision_tools_compared',
      'vision_materials_compared',
      'voice_transcribed',
      'voice_cached',
      'voice_confirmed',
      'voice_corrected',
      'voice_transcript_edited',
      'voice_fused',
      'voice_contradiction',
      'voice_language_detected',
      'voice_stt_failed',
      'voice_category_compared',
      -- Phase 7
      'assistant_shown',
      'assistant_suggestion_accepted',
      'assistant_suggestion_ignored',
      'assistant_suggestion_rejected',
      'assistant_summary_generated',
      'assistant_summary_rated',
      'assistant_offer_compared',
      'assistant_appointment_briefed',
      'assistant_after_job',
      'assistant_reminder_sent',
      'assistant_reminder_acted',
      'assistant_context_updated'
    )
  );

CREATE TABLE IF NOT EXISTS public.ai_assistant_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES public.service_requests (id) ON DELETE CASCADE,
  booking_id UUID,
  conversation_id UUID,
  audience TEXT NOT NULL CHECK (audience IN ('customer', 'provider', 'admin')),
  phase TEXT NOT NULL DEFAULT 'intake',
  -- Confirmed facts the assistant must not re-ask
  confirmed_facts JSONB NOT NULL DEFAULT '{}'::jsonb,
  asked_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_summary JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_assistant_contexts_request_audience_unique
    UNIQUE (service_request_id, audience)
);

CREATE INDEX IF NOT EXISTS ai_assistant_contexts_request_idx
  ON public.ai_assistant_contexts (service_request_id);

CREATE TABLE IF NOT EXISTS public.ai_conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  service_request_id UUID REFERENCES public.service_requests (id) ON DELETE SET NULL,
  audience TEXT NOT NULL CHECK (audience IN ('customer', 'provider', 'admin')),
  summary JSONB NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  source_hash TEXT,
  usefulness_rating SMALLINT
    CHECK (usefulness_rating IS NULL OR (usefulness_rating BETWEEN 1 AND 5)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_conversation_summaries_hash_unique UNIQUE (conversation_id, audience, source_hash)
);

CREATE INDEX IF NOT EXISTS ai_conversation_summaries_conv_idx
  ON public.ai_conversation_summaries (conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_offer_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  comparison JSONB NOT NULL,
  offer_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_offer_comparisons_request_idx
  ON public.ai_offer_comparisons (service_request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_proactive_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES public.service_requests (id) ON DELETE CASCADE,
  booking_id UUID,
  provider_id UUID,
  customer_id UUID,
  audience TEXT NOT NULL CHECK (audience IN ('customer', 'provider')),
  suggestion_type TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  action_key TEXT,
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'shown', 'accepted', 'ignored', 'rejected', 'expired')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_proactive_suggestions_pending_idx
  ON public.ai_proactive_suggestions (audience, status, priority DESC)
  WHERE status IN ('pending', 'shown');

ALTER TABLE public.ai_assistant_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_offer_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_proactive_suggestions ENABLE ROW LEVEL SECURITY;

-- Admin read for all assistant tables
DROP POLICY IF EXISTS "ai_assistant_contexts_select_admin" ON public.ai_assistant_contexts;
CREATE POLICY "ai_assistant_contexts_select_admin" ON public.ai_assistant_contexts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "ai_conversation_summaries_select_admin" ON public.ai_conversation_summaries;
CREATE POLICY "ai_conversation_summaries_select_admin" ON public.ai_conversation_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "ai_offer_comparisons_select_admin" ON public.ai_offer_comparisons;
CREATE POLICY "ai_offer_comparisons_select_admin" ON public.ai_offer_comparisons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "ai_proactive_suggestions_select_admin" ON public.ai_proactive_suggestions;
CREATE POLICY "ai_proactive_suggestions_select_admin" ON public.ai_proactive_suggestions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );

-- Customers can read their request context / offer comparisons / suggestions
DROP POLICY IF EXISTS "ai_assistant_contexts_select_customer" ON public.ai_assistant_contexts;
CREATE POLICY "ai_assistant_contexts_select_customer" ON public.ai_assistant_contexts
  FOR SELECT USING (
    audience = 'customer'
    AND service_request_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = ai_assistant_contexts.service_request_id
        AND sr.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_offer_comparisons_select_customer" ON public.ai_offer_comparisons;
CREATE POLICY "ai_offer_comparisons_select_customer" ON public.ai_offer_comparisons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = ai_offer_comparisons.service_request_id
        AND sr.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ai_proactive_suggestions_select_customer" ON public.ai_proactive_suggestions;
CREATE POLICY "ai_proactive_suggestions_select_customer" ON public.ai_proactive_suggestions
  FOR SELECT USING (
    audience = 'customer' AND customer_id = auth.uid()
  );

DROP POLICY IF EXISTS "ai_proactive_suggestions_select_provider" ON public.ai_proactive_suggestions;
CREATE POLICY "ai_proactive_suggestions_select_provider" ON public.ai_proactive_suggestions
  FOR SELECT USING (
    audience = 'provider'
    AND provider_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = ai_proactive_suggestions.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );
