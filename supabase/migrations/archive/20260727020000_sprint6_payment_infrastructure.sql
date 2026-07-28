-- Sprint 6 Phase 2 — Subscription & Lead Payment Infrastructure
-- Provider-agnostic payment spine (manual first; Stripe-ready stubs).

-- Expand payment purposes (drop/recreate CHECK)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN (
    'subscription',
    'business_subscription',
    'unlock_fee',
    'lead_unlock',
    'refund',
    'credit',
    'wallet',
    'invoice'
  ));

-- Lifecycle timestamps + provider reference fields
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_reference TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'expired';

-- Immutable payment status snapshots (append-only history)
CREATE TABLE IF NOT EXISTS public.payment_status_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id UUID,
  source TEXT NOT NULL DEFAULT 'system'
    CHECK (source IN ('system', 'admin', 'webhook', 'provider', 'cron', 'user')),
  note TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_status_snapshots_payment_idx
  ON public.payment_status_snapshots (payment_id, created_at ASC);

-- Dedicated lead unlock payment records (links payment ↔ unlock ↔ AI price)
CREATE TABLE IF NOT EXISTS public.lead_unlock_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  unlock_session_id UUID NOT NULL REFERENCES public.unlock_sessions(id) ON DELETE CASCADE,
  service_request_id UUID,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  ai_price_usd NUMERIC(10,2),
  ai_score NUMERIC(8,4),
  pricing_history_id UUID,
  currency TEXT NOT NULL DEFAULT 'USD',
  unlock_granted BOOLEAN NOT NULL DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_unlock_payments_provider_idx
  ON public.lead_unlock_payments (provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS lead_unlock_payments_session_idx
  ON public.lead_unlock_payments (unlock_session_id);

-- Business subscription payment periods
CREATE TABLE IF NOT EXISTS public.business_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  monetization_plan_id UUID REFERENCES public.provider_monetization_plans(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  renewal BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_subscription_payments_provider_idx
  ON public.business_subscription_payments (provider_id, created_at DESC);

-- Canonical provider-agnostic webhook event catalog (documentation + soft validation)
CREATE TABLE IF NOT EXISTS public.payment_provider_event_types (
  event_type TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

INSERT INTO public.payment_provider_event_types (event_type, description) VALUES
  ('payment_succeeded', 'Payment captured successfully'),
  ('payment_failed', 'Payment failed'),
  ('payment_cancelled', 'Payment cancelled'),
  ('payment_expired', 'Payment expired'),
  ('subscription_renewed', 'Subscription renewed for a new period'),
  ('subscription_cancelled', 'Subscription cancelled'),
  ('refund_succeeded', 'Refund completed (future)'),
  ('refund_failed', 'Refund failed (future)')
ON CONFLICT (event_type) DO NOTHING;

-- Learning events
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
      'lead_price_calculated','lead_unlock_started','lead_unlock_included','lead_unlock_paid',
      'lead_unlock_granted','business_plan_upgraded','business_plan_cancelled',
      'included_unlock_consumed','included_unlocks_reset','monetization_settings_changed',
      -- Sprint 6 Phase 2
      'payment_created','payment_succeeded','payment_failed','payment_cancelled','payment_expired',
      'subscription_payment_started','subscription_payment_activated','subscription_renewed',
      'subscription_cancelled','lead_payment_recorded','payment_history_viewed','payment_receipt_downloaded'
    )
  );

-- RLS
ALTER TABLE public.payment_status_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_unlock_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_snapshots_admin ON public.payment_status_snapshots;
CREATE POLICY payment_snapshots_admin ON public.payment_status_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS lead_unlock_payments_own ON public.lead_unlock_payments;
CREATE POLICY lead_unlock_payments_own ON public.lead_unlock_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS business_sub_payments_own ON public.business_subscription_payments;
CREATE POLICY business_sub_payments_own ON public.business_subscription_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
    OR public.has_role('admin')
  );

COMMENT ON TABLE public.lead_unlock_payments IS
  'Sprint 6 Phase 2 — lead unlock payment correlation (AI price + grant).';
COMMENT ON TABLE public.payment_status_snapshots IS
  'Sprint 6 Phase 2 — append-only immutable payment status history.';
COMMENT ON TABLE public.business_subscription_payments IS
  'Sprint 6 Phase 2 — Business $20/mo subscription payment periods.';
