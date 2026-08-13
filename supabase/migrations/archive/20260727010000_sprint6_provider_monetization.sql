-- Sprint 6 Phase 1 — Provider Monetization & Lead Payments
-- Providers pay to unlock leads (not commission). FREE vs BUSINESS ($20 / 10 unlocks).

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
      'request_published','dual_path_switched','slot_suggested','slot_suggestion_accepted','slot_suggestion_rejected',
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
      'notif_center_opened','notif_opened','notif_dismissed','notif_archived','notif_deleted',
      'notif_action_completed','notif_marked_read','notif_marked_unread','notif_digest_opened',
      'notif_digest_generated','notif_preference_changed','notif_grouped','notif_group_opened',
      'notif_priority_boost_suggested','notif_channel_delivered','notif_channel_skipped',
      -- Sprint 6 Phase 1
      'lead_price_calculated','lead_unlock_started','lead_unlock_included','lead_unlock_paid',
      'lead_unlock_granted','business_plan_upgraded','business_plan_cancelled',
      'included_unlock_consumed','included_unlocks_reset','monetization_settings_changed'
    )
  );

-- Singleton / versioned billing settings (admin-configurable)
CREATE TABLE IF NOT EXISTS public.monetization_billing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_price_usd NUMERIC(10,2) NOT NULL DEFAULT 20.00,
  included_unlocks INTEGER NOT NULL DEFAULT 10 CHECK (included_unlocks >= 0),
  min_lead_price_usd NUMERIC(10,2) NOT NULL DEFAULT 2.00,
  max_lead_price_usd NUMERIC(10,2) NOT NULL DEFAULT 20.00,
  base_lead_price_usd NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  emergency_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.500,
  urgency_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.250,
  multi_service_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.350,
  complexity_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.200,
  distance_multiplier_per_km NUMERIC(6,4) NOT NULL DEFAULT 0.0200,
  demand_multiplier NUMERIC(6,3) NOT NULL DEFAULT 1.100,
  category_multipliers JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (min_lead_price_usd > 0),
  CHECK (max_lead_price_usd >= min_lead_price_usd)
);

INSERT INTO public.monetization_billing_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.monetization_billing_settings WHERE is_active = true);

-- Provider monetization plan (FREE | BUSINESS) — orthogonal to legacy pro/premium tools
CREATE TABLE IF NOT EXISTS public.provider_monetization_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL UNIQUE REFERENCES public.providers(id) ON DELETE CASCADE,
  billing_mode TEXT NOT NULL DEFAULT 'free'
    CHECK (billing_mode IN ('free', 'business')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'cancelled')),
  business_started_at TIMESTAMPTZ,
  business_expires_at TIMESTAMPTZ,
  billing_period_start DATE,
  billing_period_end DATE,
  premium_badge BOOLEAN NOT NULL DEFAULT false,
  search_boost BOOLEAN NOT NULL DEFAULT false,
  analytics_enabled BOOLEAN NOT NULL DEFAULT false,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_insights_enabled BOOLEAN NOT NULL DEFAULT false,
  subscription_payment_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_monetization_plans_mode_idx
  ON public.provider_monetization_plans (billing_mode, status);

-- Monthly included-unlock usage (no carry-over)
CREATE TABLE IF NOT EXISTS public.provider_monthly_unlock_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  period_ym TEXT NOT NULL, -- YYYY-MM
  included_allowance INTEGER NOT NULL DEFAULT 10,
  used_count INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, period_ym),
  CHECK (used_count >= 0),
  CHECK (included_allowance >= 0)
);

CREATE INDEX IF NOT EXISTS provider_monthly_unlock_usage_period_idx
  ON public.provider_monthly_unlock_usage (period_ym);

-- AI lead pricing history (audit + transparency)
CREATE TABLE IF NOT EXISTS public.lead_pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unlock_session_id UUID REFERENCES public.unlock_sessions(id) ON DELETE SET NULL,
  service_request_id UUID,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  ai_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  base_price_usd NUMERIC(10,2) NOT NULL,
  final_price_usd NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation_en TEXT NOT NULL DEFAULT '',
  explanation_ar TEXT NOT NULL DEFAULT '',
  estimated_project_value_usd NUMERIC(12,2),
  estimated_duration_hours NUMERIC(8,2),
  potential_revenue_usd NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_pricing_history_session_idx
  ON public.lead_pricing_history (unlock_session_id);

CREATE INDEX IF NOT EXISTS lead_pricing_history_provider_idx
  ON public.lead_pricing_history (provider_id, created_at DESC);

-- Enrich unlock_sessions for monetization transparency
ALTER TABLE public.unlock_sessions
  ADD COLUMN IF NOT EXISTS pricing_history_id UUID,
  ADD COLUMN IF NOT EXISTS unlock_method TEXT
    CHECK (unlock_method IS NULL OR unlock_method IN (
      'included', 'pay_per_lead', 'dev_bypass', 'admin', 'legacy'
    )),
  ADD COLUMN IF NOT EXISTS ai_price_usd NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS ai_score NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS pricing_explanation_en TEXT,
  ADD COLUMN IF NOT EXISTS pricing_explanation_ar TEXT;

-- Monetization audit log
CREATE TABLE IF NOT EXISTS public.monetization_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  provider_id UUID,
  event_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monetization_audit_logs_provider_idx
  ON public.monetization_audit_logs (provider_id, created_at DESC);

-- RLS
ALTER TABLE public.monetization_billing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_monetization_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_monthly_unlock_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_pricing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS monetization_settings_admin ON public.monetization_billing_settings;
CREATE POLICY monetization_settings_admin ON public.monetization_billing_settings
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS monetization_settings_read ON public.monetization_billing_settings;
CREATE POLICY monetization_settings_read ON public.monetization_billing_settings
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS provider_monetization_own ON public.provider_monetization_plans;
CREATE POLICY provider_monetization_own ON public.provider_monetization_plans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS provider_unlock_usage_own ON public.provider_monthly_unlock_usage;
CREATE POLICY provider_unlock_usage_own ON public.provider_monthly_unlock_usage
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS lead_pricing_own_select ON public.lead_pricing_history;
CREATE POLICY lead_pricing_own_select ON public.lead_pricing_history
  FOR SELECT TO authenticated
  USING (
    provider_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS monetization_audit_admin ON public.monetization_audit_logs;
CREATE POLICY monetization_audit_admin ON public.monetization_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

COMMENT ON TABLE public.provider_monetization_plans IS
  'Sprint 6 Phase 1 — FREE (pay-per-lead) vs BUSINESS ($20/mo, 10 included unlocks).';
COMMENT ON TABLE public.lead_pricing_history IS
  'Sprint 6 Phase 1 — AI unlock price snapshots with explanations.';
