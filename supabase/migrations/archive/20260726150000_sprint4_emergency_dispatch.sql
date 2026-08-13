-- Sprint 4 Phase 3 — Emergency Dispatch & Live Tracking

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
      'automation_suggested',
      'automation_executed',
      'automation_confirmed',
      'automation_rejected',
      'automation_modified',
      'automation_reversed',
      'automation_blocked_safety',
      'workflow_run',
      'marketplace_mode_chosen',
      'ai_path_recommendation_accepted',
      'ai_path_recommendation_ignored',
      'provider_contacted_directly',
      'request_published',
      'dual_path_switched',
      'slot_suggested',
      'slot_suggestion_accepted',
      'slot_suggestion_rejected',
      'appointment_cancelled',
      'appointment_delayed',
      'appointment_duration_compared',
      'appointment_arrival_compared',
      'day_schedule_optimized',
      'reschedule_suggested',
      'reschedule_accepted',
      'reschedule_rejected',
      'booking_reminder_sent',
      -- Sprint 4 Phase 3
      'emergency_detected',
      'emergency_dispatch_started',
      'emergency_provider_notified',
      'emergency_accepted',
      'emergency_declined',
      'emergency_busy',
      'emergency_on_the_way',
      'emergency_arrived',
      'emergency_work_started',
      'emergency_completed',
      'emergency_dispatch_stopped',
      'live_eta_updated',
      'live_location_shared',
      'live_location_disabled'
    )
  );

CREATE TABLE IF NOT EXISTS public.emergency_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'dispatching'
    CHECK (status IN (
      'detected',
      'dispatching',
      'awaiting_accept',
      'accepted',
      'on_the_way',
      'arrived',
      'in_progress',
      'completed',
      'cancelled',
      'stopped'
    )),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  accepted_provider_id UUID,
  accepted_assignment_id UUID,
  target_accepts INTEGER NOT NULL DEFAULT 1
    CHECK (target_accepts >= 1 AND target_accepts <= 5),
  notified_count INTEGER NOT NULL DEFAULT 0,
  accepted_count INTEGER NOT NULL DEFAULT 0,
  eta_minutes_min INTEGER,
  eta_minutes_max INTEGER,
  eta_label TEXT,
  eta_updated_at TIMESTAMPTZ,
  dispatch_duration_seconds INTEGER,
  city_id UUID,
  category_slug TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emergency_dispatches_status_idx
  ON public.emergency_dispatches (status, activated_at DESC);

CREATE TABLE IF NOT EXISTS public.emergency_dispatch_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES public.emergency_dispatches(id) ON DELETE CASCADE,
  service_request_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  assignment_id UUID,
  response TEXT NOT NULL
    CHECK (response IN ('notified', 'accepted', 'declined', 'busy', 'on_the_way', 'arrived', 'started', 'completed')),
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  eta_minutes INTEGER,
  note TEXT,
  UNIQUE (dispatch_id, provider_id, response)
);

CREATE INDEX IF NOT EXISTS emergency_dispatch_responses_dispatch_idx
  ON public.emergency_dispatch_responses (dispatch_id, responded_at DESC);

CREATE TABLE IF NOT EXISTS public.emergency_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES public.emergency_dispatches(id) ON DELETE CASCADE,
  service_request_id UUID NOT NULL,
  event_key TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system'
    CHECK (actor IN ('system', 'customer', 'provider', 'admin')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emergency_timeline_events_request_idx
  ON public.emergency_timeline_events (service_request_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.emergency_live_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES public.emergency_dispatches(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL,
  service_request_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  sharing_enabled BOOLEAN NOT NULL DEFAULT true,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dispatch_id, provider_id)
);

CREATE INDEX IF NOT EXISTS emergency_live_locations_request_idx
  ON public.emergency_live_locations (service_request_id);

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS share_live_location_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.emergency_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_dispatch_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_live_locations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'emergency_dispatches',
    'emergency_dispatch_responses',
    'emergency_timeline_events',
    'emergency_live_locations'
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

-- Customers can read their own emergency dispatch + timeline
DROP POLICY IF EXISTS emergency_dispatches_customer ON public.emergency_dispatches;
CREATE POLICY emergency_dispatches_customer
  ON public.emergency_dispatches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = service_request_id AND sr.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS emergency_timeline_customer ON public.emergency_timeline_events;
CREATE POLICY emergency_timeline_customer
  ON public.emergency_timeline_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = service_request_id AND sr.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS emergency_live_locations_customer ON public.emergency_live_locations;
CREATE POLICY emergency_live_locations_customer
  ON public.emergency_live_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = service_request_id AND sr.customer_id = auth.uid()
    )
    AND sharing_enabled = true
  );

-- Assigned providers can read/update responses for their dispatch
DROP POLICY IF EXISTS emergency_responses_provider ON public.emergency_dispatch_responses;
CREATE POLICY emergency_responses_provider
  ON public.emergency_dispatch_responses FOR ALL
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

DROP POLICY IF EXISTS emergency_live_locations_provider ON public.emergency_live_locations;
CREATE POLICY emergency_live_locations_provider
  ON public.emergency_live_locations FOR ALL
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
