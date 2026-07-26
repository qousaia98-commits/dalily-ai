-- AI Engine Phase 9 — Autonomous Actions & Workflow Automation

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
      'assistant_context_updated',
      'forecast_correct',
      'forecast_incorrect',
      'capacity_prediction',
      'demand_prediction',
      'wait_time_prediction',
      'notification_clicked',
      'recommendation_followed',
      'balance_action_recommended',
      'prediction_calibrated',
      -- Phase 9
      'automation_suggested',
      'automation_executed',
      'automation_confirmed',
      'automation_rejected',
      'automation_modified',
      'automation_reversed',
      'automation_blocked_safety',
      'workflow_run'
    )
  );

-- Configurable confidence thresholds (single-row style via policy_key)
CREATE TABLE IF NOT EXISTS public.ai_automation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE DEFAULT 'default',
  auto_execute_min NUMERIC(5, 4) NOT NULL DEFAULT 0.95
    CHECK (auto_execute_min >= 0 AND auto_execute_min <= 1),
  confirm_min NUMERIC(5, 4) NOT NULL DEFAULT 0.80
    CHECK (confirm_min >= 0 AND confirm_min <= 1),
  recommend_below NUMERIC(5, 4) NOT NULL DEFAULT 0.80
    CHECK (recommend_below >= 0 AND recommend_below <= 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.ai_automation_policies (policy_key)
VALUES ('default')
ON CONFLICT (policy_key) DO NOTHING;

-- Provider opt-in for autonomous actions (never financial)
CREATE TABLE IF NOT EXISTS public.ai_provider_automation_settings (
  provider_id UUID PRIMARY KEY,
  auto_accept_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_reject_out_of_area BOOLEAN NOT NULL DEFAULT true,
  auto_reject_outside_hours BOOLEAN NOT NULL DEFAULT true,
  suggest_route_optimization BOOLEAN NOT NULL DEFAULT true,
  suggest_schedule_gaps BOOLEAN NOT NULL DEFAULT true,
  min_auto_accept_confidence NUMERIC(5, 4) NOT NULL DEFAULT 0.95
    CHECK (min_auto_accept_confidence >= 0.8 AND min_auto_accept_confidence <= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_provider_automation_settings_accept_idx
  ON public.ai_provider_automation_settings (auto_accept_enabled)
  WHERE auto_accept_enabled = true;

-- Immutable-style audit of every automation decision/action
CREATE TABLE IF NOT EXISTS public.ai_automation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT NOT NULL,
  trigger_key TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('customer', 'provider', 'admin', 'system')),
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'recommended'
    CHECK (status IN (
      'recommended',
      'pending_confirmation',
      'executed',
      'failed',
      'rejected',
      'modified',
      'reversed',
      'blocked_safety'
    )),
  confidence NUMERIC(6, 4)
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  decision_mode TEXT NOT NULL DEFAULT 'recommend'
    CHECK (decision_mode IN ('auto_execute', 'confirm', 'recommend', 'blocked')),
  reason_en TEXT NOT NULL,
  reason_ar TEXT NOT NULL,
  data_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  module TEXT NOT NULL DEFAULT 'automation',
  reversible BOOLEAN NOT NULL DEFAULT true,
  reversed_at TIMESTAMPTZ,
  user_id UUID,
  provider_id UUID,
  service_request_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_automation_actions_status_idx
  ON public.ai_automation_actions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_automation_actions_workflow_idx
  ON public.ai_automation_actions (workflow_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_automation_actions_audience_idx
  ON public.ai_automation_actions (audience, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_automation_actions_request_idx
  ON public.ai_automation_actions (service_request_id)
  WHERE service_request_id IS NOT NULL;

-- Pending confirmations (80–94% confidence band)
CREATE TABLE IF NOT EXISTS public.ai_automation_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.ai_automation_actions(id) ON DELETE CASCADE,
  audience TEXT NOT NULL CHECK (audience IN ('customer', 'provider', 'admin')),
  user_id UUID,
  provider_id UUID,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'modified')),
  modified_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  CONSTRAINT ai_automation_approvals_action_unique UNIQUE (action_id)
);

CREATE INDEX IF NOT EXISTS ai_automation_approvals_pending_idx
  ON public.ai_automation_approvals (status, created_at DESC)
  WHERE status = 'pending';

-- Learning: suggested vs user decision
CREATE TABLE IF NOT EXISTS public.ai_automation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.ai_automation_actions(id) ON DELETE CASCADE,
  suggested_action TEXT NOT NULL,
  user_decision TEXT NOT NULL
    CHECK (user_decision IN ('accepted', 'rejected', 'modified', 'ignored')),
  confidence_before NUMERIC(6, 4),
  confidence_delta NUMERIC(6, 4),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_automation_feedback_action_idx
  ON public.ai_automation_feedback (action_id);

CREATE INDEX IF NOT EXISTS ai_automation_feedback_decision_idx
  ON public.ai_automation_feedback (user_decision, created_at DESC);

ALTER TABLE public.ai_automation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_automation_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_automation_feedback ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_automation_policies',
    'ai_provider_automation_settings',
    'ai_automation_actions',
    'ai_automation_approvals',
    'ai_automation_feedback'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      t || '_select_admin',
      t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = ''admin'' AND revoked_at IS NULL
        )
      )',
      t || '_select_admin',
      t
    );
  END LOOP;
END $$;

-- Providers can read/update their own automation settings
DROP POLICY IF EXISTS ai_provider_automation_settings_owner ON public.ai_provider_automation_settings;
CREATE POLICY ai_provider_automation_settings_owner
  ON public.ai_provider_automation_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

-- Users can see their own automation actions / approvals
DROP POLICY IF EXISTS ai_automation_actions_self ON public.ai_automation_actions;
CREATE POLICY ai_automation_actions_self
  ON public.ai_automation_actions
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_automation_approvals_self ON public.ai_automation_approvals;
CREATE POLICY ai_automation_approvals_self
  ON public.ai_automation_approvals
  FOR SELECT
  USING (user_id = auth.uid());
