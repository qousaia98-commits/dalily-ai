-- Sprint 5 Phase 3 — AI Communication Assistant

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
      -- Sprint 5 Phase 3
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
      'chat_ai_summary_deleted'
    )
  );

-- User privacy preferences for chat AI
CREATE TABLE IF NOT EXISTS public.ai_chat_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  preferred_language TEXT
    CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'ar', 'de', 'auto')),
  auto_translate BOOLEAN NOT NULL DEFAULT false,
  allow_summaries BOOLEAN NOT NULL DEFAULT true,
  allow_suggestions BOOLEAN NOT NULL DEFAULT true,
  allow_extraction BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_chat_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_chat_preferences_self ON public.ai_chat_preferences;
CREATE POLICY ai_chat_preferences_self ON public.ai_chat_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Enhanced conversation summaries (Phase 3 windows + styles)
ALTER TABLE public.ai_conversation_summaries
  ADD COLUMN IF NOT EXISTS window_key TEXT NOT NULL DEFAULT 'last_10'
    CHECK (window_key IN ('last_10', 'today', 'last_7_days', 'entire')),
  ADD COLUMN IF NOT EXISTS style_key TEXT NOT NULL DEFAULT 'short'
    CHECK (style_key IN ('short', 'detailed', 'timeline', 'action')),
  ADD COLUMN IF NOT EXISTS generated_by TEXT NOT NULL DEFAULT 'rules'
    CHECK (generated_by IN ('rules', 'llm', 'hybrid')),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

CREATE INDEX IF NOT EXISTS ai_conversation_summaries_conv_window_idx
  ON public.ai_conversation_summaries (conversation_id, window_key, style_key, created_at DESC)
  WHERE deleted_at IS NULL;

-- Structured extractions from chat
CREATE TABLE IF NOT EXISTS public.ai_chat_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID,
  field_key TEXT NOT NULL
    CHECK (field_key IN (
      'appointment', 'address', 'phone', 'budget', 'requested_date',
      'service_type', 'materials', 'urgency', 'other'
    )),
  field_value TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5
    CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'user', 'corrected')),
  locale TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_chat_extractions_conv_idx
  ON public.ai_chat_extractions (conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.ai_chat_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_chat_extractions_participant_select ON public.ai_chat_extractions;
CREATE POLICY ai_chat_extractions_participant_select ON public.ai_chat_extractions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS ai_chat_extractions_participant_write ON public.ai_chat_extractions;
CREATE POLICY ai_chat_extractions_participant_write ON public.ai_chat_extractions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS ai_chat_extractions_participant_update ON public.ai_chat_extractions;
CREATE POLICY ai_chat_extractions_participant_update ON public.ai_chat_extractions
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()))
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

-- Action items / tasks detected in chat
CREATE TABLE IF NOT EXISTS public.ai_chat_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  message_id UUID,
  title TEXT NOT NULL,
  title_ar TEXT,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN (
      'send_invoice', 'upload_photo', 'confirm_appointment',
      'call_customer', 'order_materials', 'other'
    )),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'dismissed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  assignee_role TEXT
    CHECK (assignee_role IS NULL OR assignee_role IN ('customer', 'provider', 'admin', 'either')),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_chat_action_items_open_idx
  ON public.ai_chat_action_items (conversation_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.ai_chat_action_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_chat_action_items_participant_select ON public.ai_chat_action_items;
CREATE POLICY ai_chat_action_items_participant_select ON public.ai_chat_action_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS ai_chat_action_items_participant_insert ON public.ai_chat_action_items;
CREATE POLICY ai_chat_action_items_participant_insert ON public.ai_chat_action_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS ai_chat_action_items_participant_update ON public.ai_chat_action_items;
CREATE POLICY ai_chat_action_items_participant_update ON public.ai_chat_action_items
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()))
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

-- Sentiment / priority snapshots (subtle indicators)
CREATE TABLE IF NOT EXISTS public.ai_chat_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sentiment TEXT NOT NULL DEFAULT 'neutral'
    CHECK (sentiment IN ('positive', 'neutral', 'frustrated', 'urgent', 'escalation_risk')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  score NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_chat_sentiment_conv_idx
  ON public.ai_chat_sentiment (conversation_id, created_at DESC);

ALTER TABLE public.ai_chat_sentiment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_chat_sentiment_participant_select ON public.ai_chat_sentiment;
CREATE POLICY ai_chat_sentiment_participant_select ON public.ai_chat_sentiment
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS ai_chat_sentiment_participant_insert ON public.ai_chat_sentiment;
CREATE POLICY ai_chat_sentiment_participant_insert ON public.ai_chat_sentiment
  FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

-- Message translation cache (view original vs translated)
CREATE TABLE IF NOT EXISTS public.ai_chat_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  conversation_id UUID NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL CHECK (target_lang IN ('en', 'ar', 'de')),
  translated_text TEXT NOT NULL,
  detected_lang TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, target_lang)
);

CREATE INDEX IF NOT EXISTS ai_chat_translations_conv_idx
  ON public.ai_chat_translations (conversation_id, created_at DESC);

ALTER TABLE public.ai_chat_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_chat_translations_participant_select ON public.ai_chat_translations;
CREATE POLICY ai_chat_translations_participant_select ON public.ai_chat_translations
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS ai_chat_translations_participant_insert ON public.ai_chat_translations;
CREATE POLICY ai_chat_translations_participant_insert ON public.ai_chat_translations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

COMMENT ON TABLE public.ai_chat_preferences IS
  'Sprint 5 Phase 3 — user opt-in/out for chat AI. Private chat content is not used for model training.';
COMMENT ON TABLE public.ai_chat_extractions IS
  'Sprint 5 Phase 3 — structured facts extracted from conversations for downstream workflows.';
COMMENT ON TABLE public.ai_chat_action_items IS
  'Sprint 5 Phase 3 — detected tasks; AI never auto-sends messages.';
