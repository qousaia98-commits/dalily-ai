-- Sprint 5 Phase 4 — Voice Messages & Smart Voice Assistant

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
      'live_location_disabled',
      'project_detected',
      'project_created',
      'project_plan_generated',
      'project_plan_reordered',
      'project_package_matched',
      'project_package_booked',
      'project_package_started',
      'project_package_completed',
      'project_dependency_blocked',
      'project_delay_detected',
      'project_schedule_adjusted',
      'project_completed',
      'project_duration_compared',
      'recurring_plan_created',
      'recurring_plan_renewed',
      'recurring_plan_paused',
      'recurring_plan_resumed',
      'recurring_plan_cancelled',
      'recurring_visit_skipped',
      'recurring_visit_rescheduled',
      'recurring_visit_completed',
      'recurring_visit_generated',
      'recurring_recommendation_shown',
      'recurring_recommendation_accepted',
      'recurring_recommendation_rejected',
      'recurring_reminder_sent',
      'recurring_route_optimized',
      'maintenance_due_detected',
      'chat_message_sent',
      'chat_message_edited',
      'chat_message_deleted',
      'chat_reply_sent',
      'chat_message_pinned',
      'chat_message_unpinned',
      'chat_read',
      'chat_mark_all_read',
      'chat_search',
      'chat_typing',
      'chat_presence',
      'chat_reply_latency',
      'chat_read_latency',
      'chat_conversation_opened',
      'chat_emergency_response',
      'media_file_uploaded',
      'media_file_viewed',
      'media_file_downloaded',
      'media_preview_opened',
      'media_voice_played',
      'media_gallery_viewed',
      'media_project_shared',
      'media_file_renamed',
      'media_file_deleted',
      'media_file_restored',
      'media_file_replaced',
      'media_file_pinned',
      'media_processing_queued',
      'media_processing_completed',
      'chat_ai_summary_generated',
      'chat_ai_reply_suggested',
      'chat_ai_reply_accepted',
      'chat_ai_reply_edited',
      'chat_ai_translation_used',
      'chat_ai_extraction_created',
      'chat_ai_extraction_corrected',
      'chat_ai_task_detected',
      'chat_ai_task_completed',
      'chat_ai_sentiment_scored',
      'chat_ai_panel_opened',
      'chat_ai_disabled',
      'chat_ai_enabled',
      'chat_ai_summary_deleted',
      -- Sprint 5 Phase 4
      'chat_voice_recorded',
      'chat_voice_played',
      'chat_voice_transcript_generated',
      'chat_voice_transcript_deleted',
      'chat_voice_summary_generated',
      'chat_voice_translation_used',
      'chat_voice_transcript_searched',
      'chat_voice_consent_granted',
      'chat_voice_consent_revoked'
    )
  );

-- Voice consent on chat AI preferences
ALTER TABLE public.ai_chat_preferences
  ADD COLUMN IF NOT EXISTS allow_voice_transcription BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_consent_at TIMESTAMPTZ;

-- Chat voice transcripts (separate from audio blob; deletable)
CREATE TABLE IF NOT EXISTS public.chat_voice_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID NOT NULL,
  attachment_id UUID,
  media_object_id UUID,
  language TEXT,
  transcript_text TEXT NOT NULL DEFAULT '',
  summary_text TEXT,
  summary_bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'ready', 'failed', 'deleted')),
  error_code TEXT,
  duration_ms INTEGER,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (message_id)
);

CREATE INDEX IF NOT EXISTS chat_voice_transcripts_conv_idx
  ON public.chat_voice_transcripts (conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS chat_voice_transcripts_fts_idx
  ON public.chat_voice_transcripts
  USING gin (to_tsvector('simple', coalesce(transcript_text, '')))
  WHERE deleted_at IS NULL AND coalesce(transcript_text, '') <> '';

-- Translated transcripts (keep original recording + original transcript)
CREATE TABLE IF NOT EXISTS public.chat_voice_transcript_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES public.chat_voice_transcripts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL,
  target_lang TEXT NOT NULL CHECK (target_lang IN ('en', 'ar', 'de')),
  translated_text TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (transcript_id, target_lang)
);

CREATE INDEX IF NOT EXISTS chat_voice_transcript_translations_conv_idx
  ON public.chat_voice_transcript_translations (conversation_id, created_at DESC);

-- Waveform peaks for playback UI (optional)
ALTER TABLE public.message_attachments
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS waveform_peaks JSONB,
  ADD COLUMN IF NOT EXISTS transcript_id UUID;

ALTER TABLE public.media_objects
  ADD COLUMN IF NOT EXISTS transcription_text TEXT,
  ADD COLUMN IF NOT EXISTS transcription_language TEXT;

ALTER TABLE public.chat_voice_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_voice_transcript_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chat_voice_transcripts_participant_select ON public.chat_voice_transcripts;
CREATE POLICY chat_voice_transcripts_participant_select ON public.chat_voice_transcripts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS chat_voice_transcripts_participant_insert ON public.chat_voice_transcripts;
CREATE POLICY chat_voice_transcripts_participant_insert ON public.chat_voice_transcripts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS chat_voice_transcripts_participant_update ON public.chat_voice_transcripts;
CREATE POLICY chat_voice_transcripts_participant_update ON public.chat_voice_transcripts
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()))
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS chat_voice_tr_participant_select ON public.chat_voice_transcript_translations;
CREATE POLICY chat_voice_tr_participant_select ON public.chat_voice_transcript_translations
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS chat_voice_tr_participant_insert ON public.chat_voice_transcript_translations;
CREATE POLICY chat_voice_tr_participant_insert ON public.chat_voice_transcript_translations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

-- Search spoken content inside a conversation (participant-scoped)
CREATE OR REPLACE FUNCTION public.search_chat_voice_transcripts(
  p_user_id UUID,
  p_query TEXT,
  p_conversation_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  message_id UUID,
  transcript_text TEXT,
  summary_text TEXT,
  language TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.conversation_id,
    t.message_id,
    t.transcript_text,
    t.summary_text,
    t.language,
    t.created_at
  FROM public.chat_voice_transcripts t
  JOIN public.conversations c ON c.id = t.conversation_id
  LEFT JOIN public.providers pr ON pr.id = c.provider_id
  WHERE t.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND (
      c.customer_id = p_user_id
      OR pr.owner_id = p_user_id
      OR c.admin_user_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id AND cp.user_id = p_user_id AND cp.deleted_at IS NULL
      )
    )
    AND (p_conversation_id IS NULL OR t.conversation_id = p_conversation_id)
    AND t.transcript_text ILIKE ('%' || p_query || '%')
  ORDER BY t.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
END;
$$;

REVOKE ALL ON FUNCTION public.search_chat_voice_transcripts FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_chat_voice_transcripts TO authenticated, service_role;

COMMENT ON TABLE public.chat_voice_transcripts IS
  'Sprint 5 Phase 4 — deletable voice transcripts. Original recordings stay in private storage. Not used for model training.';
