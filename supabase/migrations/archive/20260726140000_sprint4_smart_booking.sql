-- Sprint 4 Phase 2 — Smart Booking & AI Scheduling

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
      -- Sprint 4 Phase 2
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
      'booking_reminder_sent'
    )
  );

-- Appointment type + travel buffer on availability settings
ALTER TABLE public.provider_availability_settings
  ADD COLUMN IF NOT EXISTS default_appointment_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (default_appointment_type IN (
      'immediate', 'today', 'scheduled', 'recurring', 'emergency', 'video'
    ));

ALTER TABLE public.provider_availability_settings
  ADD COLUMN IF NOT EXISTS travel_buffer_minutes INT NOT NULL DEFAULT 20
    CHECK (travel_buffer_minutes >= 0 AND travel_buffer_minutes <= 120);

-- Prefer travel buffer as effective pad when buffer_minutes is 0
UPDATE public.provider_availability_settings
SET buffer_minutes = GREATEST(buffer_minutes, travel_buffer_minutes)
WHERE buffer_minutes = 0;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS appointment_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (appointment_type IN (
      'immediate', 'today', 'scheduled', 'recurring', 'emergency', 'video'
    ));

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS travel_buffer_minutes INT
    CHECK (travel_buffer_minutes IS NULL OR (travel_buffer_minutes >= 0 AND travel_buffer_minutes <= 120));

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS suggested_slot_rank SMALLINT;

-- Expand reminder types for smart reminders
ALTER TABLE public.booking_reminder_log
  DROP CONSTRAINT IF EXISTS booking_reminder_log_reminder_type_check;

ALTER TABLE public.booking_reminder_log
  ADD CONSTRAINT booking_reminder_log_reminder_type_check CHECK (
    reminder_type IN (
      '24h',
      '2h',
      '1h',
      'custom',
      'completion_prompt',
      'on_the_way',
      'appointment_changed',
      'after_completion'
    )
  );

CREATE TABLE IF NOT EXISTS public.booking_slot_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  provider_id UUID NOT NULL,
  customer_id UUID,
  suggested_starts_at TIMESTAMPTZ NOT NULL,
  suggested_rank SMALLINT,
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected', 'ignored', 'modified')),
  appointment_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_slot_feedback_provider_idx
  ON public.booking_slot_feedback (provider_id, created_at DESC);

ALTER TABLE public.booking_slot_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_slot_feedback_select_admin ON public.booking_slot_feedback;
CREATE POLICY booking_slot_feedback_select_admin
  ON public.booking_slot_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );
