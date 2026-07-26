-- Sprint 5 Phase 6 — Smart Notification Center

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_type_chk;

ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_type_chk CHECK (
    event_type IN (
      'provider_viewed','provider_clicked','request_started','request_sent','request_accepted',
      'request_declined','provider_no_response','request_completed','customer_cancelled','provider_cancelled',
      'review_submitted','repeat_booking','recommendation_shown','recommendation_chosen','diagnosis_completed',
      'diagnosis_abandoned','intent_suggested','intent_confirmed','intent_corrected','category_changed',
      'knowledge_hit','knowledge_miss','llm_invoked','provider_accepted','provider_declined','job_completed',
      'memory_recorded','urgency_corrected','workflow_recommended','workflow_overridden','match_ranked',
      'match_accepted','match_rejected','question_answered','intent_cached','dispatch_planned','dispatch_exposed',
      'capacity_skipped','route_boosted','response_predicted','eta_predicted','prediction_compared','reputation_updated',
      'job_analyzed','job_prep_shown','job_duration_compared','job_materials_compared','job_complexity_compared',
      'multi_service_detected','vision_analyzed','vision_cached','vision_confirmed','vision_corrected','vision_fused',
      'vision_contradiction','vision_damage_compared','vision_tools_compared','vision_materials_compared',
      'voice_transcribed','voice_cached','voice_confirmed','voice_corrected','voice_transcript_edited','voice_fused',
      'voice_contradiction','voice_language_detected','voice_stt_failed','voice_category_compared',
      'assistant_shown','assistant_suggestion_accepted','assistant_suggestion_ignored','assistant_suggestion_rejected',
      'assistant_summary_generated','assistant_summary_rated','assistant_offer_compared','assistant_appointment_briefed',
      'assistant_after_job','assistant_reminder_sent','assistant_reminder_acted','assistant_context_updated',
      'forecast_correct','forecast_incorrect','capacity_prediction','demand_prediction','wait_time_prediction',
      'notification_clicked','recommendation_followed','balance_action_recommended','prediction_calibrated',
      'automation_suggested','automation_executed','automation_confirmed','automation_rejected','automation_modified',
      'automation_reversed','automation_blocked_safety','workflow_run','marketplace_mode_chosen',
      'ai_path_recommendation_accepted','ai_path_recommendation_ignored','provider_contacted_directly',
      'request_published','dual_path_switched','slot_suggestion_accepted','slot_suggestion_rejected','slot_suggested',
      'appointment_cancelled','appointment_delayed','appointment_duration_compared','appointment_arrival_compared',
      'day_schedule_optimized','reschedule_suggested','reschedule_accepted','reschedule_rejected','booking_reminder_sent',
      'emergency_detected','emergency_dispatch_started','emergency_provider_notified','emergency_accepted',
      'emergency_declined','emergency_busy','emergency_on_the_way','emergency_arrived','emergency_work_started',
      'emergency_completed','emergency_dispatch_stopped','live_eta_updated','live_location_shared','live_location_disabled',
      'project_detected','project_created','project_plan_generated','project_plan_reordered','project_package_matched',
      'project_package_booked','project_package_started','project_package_completed','project_dependency_blocked',
      'project_delay_detected','project_schedule_adjusted','project_completed','project_duration_compared',
      'recurring_plan_created','recurring_plan_renewed','recurring_plan_paused','recurring_plan_resumed',
      'recurring_plan_cancelled','recurring_visit_skipped','recurring_visit_rescheduled','recurring_visit_completed',
      'recurring_visit_generated','recurring_recommendation_shown','recurring_recommendation_accepted',
      'recurring_recommendation_rejected','recurring_reminder_sent','recurring_route_optimized','maintenance_due_detected',
      'chat_message_sent','chat_message_edited','chat_message_deleted','chat_reply_sent','chat_message_pinned',
      'chat_message_unpinned','chat_read','chat_mark_all_read','chat_search','chat_typing','chat_presence',
      'chat_reply_latency','chat_read_latency','chat_conversation_opened','chat_emergency_response',
      'media_file_uploaded','media_file_viewed','media_file_downloaded','media_preview_opened','media_voice_played',
      'media_gallery_viewed','media_project_shared','media_file_renamed','media_file_deleted','media_file_restored',
      'media_file_replaced','media_file_pinned','media_processing_queued','media_processing_completed',
      'chat_ai_summary_generated','chat_ai_reply_suggested','chat_ai_reply_accepted','chat_ai_reply_edited',
      'chat_ai_translation_used','chat_ai_extraction_created','chat_ai_extraction_corrected','chat_ai_task_detected',
      'chat_ai_task_completed','chat_ai_sentiment_scored','chat_ai_panel_opened','chat_ai_disabled','chat_ai_enabled',
      'chat_ai_summary_deleted','chat_voice_recorded','chat_voice_played','chat_voice_transcript_generated',
      'chat_voice_transcript_deleted','chat_voice_summary_generated','chat_voice_translation_used',
      'chat_voice_transcript_searched','chat_voice_consent_granted','chat_voice_consent_revoked',
      'collab_workspace_opened','collab_task_created','collab_task_updated','collab_task_completed',
      'collab_checklist_created','collab_checklist_item_toggled','collab_checklist_completed',
      'collab_approval_requested','collab_approval_accepted','collab_approval_rejected',
      'collab_document_versioned','collab_activity_logged','collab_ai_summary_generated',
      'collab_ai_recommendation_accepted','collab_ai_recommendation_ignored',
      -- Sprint 5 Phase 6
      'notif_center_opened','notif_opened','notif_dismissed','notif_archived','notif_deleted',
      'notif_action_completed','notif_marked_read','notif_marked_unread','notif_digest_opened',
      'notif_digest_generated','notif_preference_changed','notif_grouped','notif_group_opened',
      'notif_priority_boost_suggested','notif_channel_delivered','notif_channel_skipped'
    )
  );

-- User preferences (channels + categories + quiet hours)
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_in_app BOOLEAN NOT NULL DEFAULT true,
  channel_push BOOLEAN NOT NULL DEFAULT false,
  channel_email BOOLEAN NOT NULL DEFAULT false,
  cat_chat BOOLEAN NOT NULL DEFAULT true,
  cat_bookings BOOLEAN NOT NULL DEFAULT true,
  cat_emergency BOOLEAN NOT NULL DEFAULT true,
  cat_projects BOOLEAN NOT NULL DEFAULT true,
  cat_marketplace BOOLEAN NOT NULL DEFAULT true,
  cat_payments BOOLEAN NOT NULL DEFAULT true,
  cat_voice BOOLEAN NOT NULL DEFAULT true,
  cat_tasks BOOLEAN NOT NULL DEFAULT true,
  cat_approvals BOOLEAN NOT NULL DEFAULT true,
  cat_recurring BOOLEAN NOT NULL DEFAULT true,
  cat_invoices BOOLEAN NOT NULL DEFAULT true,
  cat_admin BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  quiet_hours_timezone TEXT NOT NULL DEFAULT 'Asia/Damascus',
  digest_morning BOOLEAN NOT NULL DEFAULT false,
  digest_daily BOOLEAN NOT NULL DEFAULT false,
  digest_weekly BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unified notification center items
CREATE TABLE IF NOT EXISTS public.smart_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL
    CHECK (category IN (
      'marketplace','bookings','emergency','projects','messages','voice',
      'tasks','approvals','recurring','invoices','payments','admin','system'
    )),
  event_key TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('critical','high','normal','low')),
  ai_suggested_priority TEXT
    CHECK (ai_suggested_priority IS NULL OR ai_suggested_priority IN (
      'critical','high','normal','low'
    )),
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_ar TEXT NOT NULL,
  href TEXT,
  action_key TEXT,
  action_label_en TEXT,
  action_label_ar TEXT,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  group_key TEXT,
  group_id UUID,
  is_group_summary BOOLEAN NOT NULL DEFAULT false,
  group_count INTEGER NOT NULL DEFAULT 1,
  source_table TEXT,
  source_id UUID,
  marketplace_notification_id UUID,
  status TEXT NOT NULL DEFAULT 'unread'
    CHECK (status IN ('unread','read','archived','deleted')),
  read_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smart_notifications_user_status_idx
  ON public.smart_notifications (user_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS smart_notifications_user_group_idx
  ON public.smart_notifications (user_id, group_key, created_at DESC)
  WHERE deleted_at IS NULL AND group_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS smart_notifications_search_idx
  ON public.smart_notifications USING gin (
    to_tsvector('simple', coalesce(title_en,'') || ' ' || coalesce(title_ar,'') || ' ' || coalesce(body_en,'') || ' ' || coalesce(body_ar,''))
  );

-- Delivery attempts (in-app / push / email)
CREATE TABLE IF NOT EXISTS public.notification_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.smart_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','push','email')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','skipped','failed')),
  skip_reason TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_delivery_attempts_notif_idx
  ON public.notification_delivery_attempts (notification_id, channel);

-- Optional push endpoint registry (no live FCM in this phase — preferences + stubs)
CREATE TABLE IF NOT EXISTS public.notification_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth TEXT,
  user_agent TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

-- AI digests
CREATE TABLE IF NOT EXISTS public.notification_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_kind TEXT NOT NULL
    CHECK (digest_kind IN ('morning','daily','weekly','unread')),
  summary_en TEXT NOT NULL,
  summary_ar TEXT NOT NULL,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  notification_ids UUID[] NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_digests_user_idx
  ON public.notification_digests (user_id, created_at DESC);

-- RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_own ON public.notification_preferences;
CREATE POLICY notification_preferences_own ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS smart_notifications_own_select ON public.smart_notifications;
CREATE POLICY smart_notifications_own_select ON public.smart_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS smart_notifications_own_update ON public.smart_notifications;
CREATE POLICY smart_notifications_own_update ON public.smart_notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notification_delivery_own_select ON public.notification_delivery_attempts;
CREATE POLICY notification_delivery_own_select ON public.notification_delivery_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_push_own ON public.notification_push_subscriptions;
CREATE POLICY notification_push_own ON public.notification_push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notification_digests_own ON public.notification_digests;
CREATE POLICY notification_digests_own ON public.notification_digests
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.smart_notifications IS
  'Sprint 5 Phase 6 — unified smart notification center. AI may suggest priority only.';
COMMENT ON TABLE public.notification_preferences IS
  'Sprint 5 Phase 6 — per-user channel/category/quiet-hours preferences.';
COMMENT ON TABLE public.notification_digests IS
  'Sprint 5 Phase 6 — AI digests over notifications the user may already view.';
