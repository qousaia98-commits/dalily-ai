-- AI Engine Phase 8 — Predictive Intelligence & Autonomous Optimization

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
      -- Phase 8
      'forecast_correct',
      'forecast_incorrect',
      'capacity_prediction',
      'demand_prediction',
      'wait_time_prediction',
      'notification_clicked',
      'recommendation_followed',
      'balance_action_recommended',
      'prediction_calibrated'
    )
  );

CREATE TABLE IF NOT EXISTS public.ai_demand_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date DATE NOT NULL,
  hour_bucket SMALLINT CHECK (hour_bucket IS NULL OR (hour_bucket >= 0 AND hour_bucket <= 23)),
  city_id UUID,
  category_slug TEXT,
  predicted_requests NUMERIC(10, 2) NOT NULL DEFAULT 0,
  confidence NUMERIC(6, 4)
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_version TEXT NOT NULL DEFAULT 'v8-heuristic',
  actual_requests INTEGER,
  compared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_demand_forecasts_unique UNIQUE NULLS NOT DISTINCT (
    forecast_date, hour_bucket, city_id, category_slug, model_version
  )
);

CREATE INDEX IF NOT EXISTS ai_demand_forecasts_date_idx
  ON public.ai_demand_forecasts (forecast_date DESC);

CREATE TABLE IF NOT EXISTS public.ai_availability_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  forecast_date DATE NOT NULL,
  predicted_free_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  predicted_bookings INTEGER NOT NULL DEFAULT 0,
  acceptance_probability NUMERIC(6, 4),
  expected_workload TEXT,
  confidence NUMERIC(6, 4),
  drivers JSONB NOT NULL DEFAULT '[]'::jsonb,
  actual_bookings INTEGER,
  compared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_availability_forecasts_unique UNIQUE (provider_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS ai_availability_forecasts_provider_idx
  ON public.ai_availability_forecasts (provider_id, forecast_date DESC);

CREATE TABLE IF NOT EXISTS public.ai_wait_time_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug TEXT NOT NULL,
  city_id UUID,
  response_min_minutes INTEGER,
  response_max_minutes INTEGER,
  arrival_min_minutes INTEGER,
  arrival_max_minutes INTEGER,
  confidence NUMERIC(6, 4),
  sample_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_wait_time_estimates_unique UNIQUE NULLS NOT DISTINCT (category_slug, city_id)
);

CREATE TABLE IF NOT EXISTS public.ai_marketplace_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  category_slug TEXT,
  city_id UUID,
  open_requests INTEGER NOT NULL DEFAULT 0,
  available_providers INTEGER NOT NULL DEFAULT 0,
  imbalance_ratio NUMERIC(10, 4),
  severity TEXT NOT NULL DEFAULT 'balanced'
    CHECK (severity IN ('balanced', 'mild', 'shortage', 'critical_shortage', 'oversupply')),
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_marketplace_balances_snap_idx
  ON public.ai_marketplace_balances (snapshot_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_prediction_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_type TEXT NOT NULL,
  reference_id UUID,
  predicted JSONB NOT NULL,
  actual JSONB,
  error_metric NUMERIC(12, 4),
  was_correct BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  compared_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_prediction_outcomes_type_idx
  ON public.ai_prediction_outcomes (prediction_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_predictive_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience TEXT NOT NULL CHECK (audience IN ('customer', 'provider', 'admin')),
  user_id UUID,
  provider_id UUID,
  notification_type TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'shown', 'clicked', 'dismissed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_predictive_notifications_audience_idx
  ON public.ai_predictive_notifications (audience, status, created_at DESC);

ALTER TABLE public.ai_demand_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_availability_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_wait_time_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_marketplace_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prediction_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_predictive_notifications ENABLE ROW LEVEL SECURITY;

-- Admin read policies
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_demand_forecasts',
    'ai_availability_forecasts',
    'ai_wait_time_estimates',
    'ai_marketplace_balances',
    'ai_prediction_outcomes',
    'ai_predictive_notifications'
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
