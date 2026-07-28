-- Sprint 6 Phase 6 — Finance analytics views, indexes, cache (no duplicated financial rows)

-- Performance indexes on existing payment / refund data
CREATE INDEX IF NOT EXISTS payments_paid_at_idx
  ON public.payments (paid_at DESC)
  WHERE payment_status = 'paid';

CREATE INDEX IF NOT EXISTS payments_purpose_status_paid_idx
  ON public.payments (purpose, payment_status, paid_at DESC);

CREATE INDEX IF NOT EXISTS payments_provider_paid_idx
  ON public.payments (provider_id, payment_status, paid_at DESC);

CREATE INDEX IF NOT EXISTS refund_requests_succeeded_idx
  ON public.refund_requests (status, completed_at DESC)
  WHERE status = 'succeeded';

CREATE INDEX IF NOT EXISTS payment_disputes_status_opened_idx
  ON public.payment_disputes (status, opened_at DESC);

CREATE INDEX IF NOT EXISTS business_sub_payments_activated_idx
  ON public.business_subscription_payments (activated_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS lead_unlock_payments_unlocked_idx
  ON public.lead_unlock_payments (unlocked_at DESC NULLS LAST)
  WHERE unlock_granted = true;

-- Analytics view: paid payments with net amount (does not duplicate rows)
CREATE OR REPLACE VIEW public.finance_paid_payments_v AS
SELECT
  p.id,
  p.provider_id,
  p.purpose,
  p.currency,
  p.amount::numeric AS gross_amount,
  COALESCE(p.refunded_amount, 0)::numeric AS refunded_amount,
  (p.amount - COALESCE(p.refunded_amount, 0))::numeric AS net_amount,
  p.payment_status,
  p.refund_status,
  p.payment_reference,
  p.paid_at,
  p.created_at,
  date_trunc('day', COALESCE(p.paid_at, p.created_at))::date AS paid_day,
  date_trunc('month', COALESCE(p.paid_at, p.created_at))::date AS paid_month
FROM public.payments p
WHERE p.payment_status = 'paid';

COMMENT ON VIEW public.finance_paid_payments_v IS
  'Sprint 6 Phase 6 — read-only paid payments with net revenue (no data duplication).';

-- Daily revenue aggregation view
CREATE OR REPLACE VIEW public.finance_daily_revenue_v AS
SELECT
  paid_day AS day,
  currency,
  COUNT(*)::bigint AS payment_count,
  SUM(gross_amount)::numeric AS gross_revenue,
  SUM(refunded_amount)::numeric AS refunded,
  SUM(net_amount)::numeric AS net_revenue,
  SUM(CASE WHEN purpose IN ('unlock_fee', 'lead_unlock') THEN net_amount ELSE 0 END)::numeric AS lead_revenue,
  SUM(CASE WHEN purpose = 'business_subscription' THEN net_amount ELSE 0 END)::numeric AS subscription_revenue
FROM public.finance_paid_payments_v
GROUP BY paid_day, currency;

COMMENT ON VIEW public.finance_daily_revenue_v IS
  'Sprint 6 Phase 6 — daily revenue rollup by currency.';

-- Monthly revenue aggregation view
CREATE OR REPLACE VIEW public.finance_monthly_revenue_v AS
SELECT
  paid_month AS month,
  currency,
  COUNT(*)::bigint AS payment_count,
  SUM(gross_amount)::numeric AS gross_revenue,
  SUM(refunded_amount)::numeric AS refunded,
  SUM(net_amount)::numeric AS net_revenue,
  SUM(CASE WHEN purpose IN ('unlock_fee', 'lead_unlock') THEN net_amount ELSE 0 END)::numeric AS lead_revenue,
  SUM(CASE WHEN purpose = 'business_subscription' THEN net_amount ELSE 0 END)::numeric AS subscription_revenue
FROM public.finance_paid_payments_v
GROUP BY paid_month, currency;

-- Cached snapshot table (JSON aggregations, TTL-based)
CREATE TABLE IF NOT EXISTS public.finance_analytics_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  computed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finance_analytics_cache_expires_idx
  ON public.finance_analytics_cache (expires_at);

ALTER TABLE public.finance_analytics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_analytics_cache_admin ON public.finance_analytics_cache;
CREATE POLICY finance_analytics_cache_admin ON public.finance_analytics_cache
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

-- Learning event types (append Phase 6)
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
      'payment_created','payment_succeeded','payment_failed','payment_cancelled','payment_expired',
      'subscription_payment_started','subscription_payment_activated','subscription_renewed',
      'subscription_cancelled','lead_payment_recorded','payment_history_viewed','payment_receipt_downloaded',
      'invoice_generated','receipt_generated','pdf_downloaded','pdf_regenerated',
      'pdf_generation_failed','document_accessed','credit_note_generated',
      'refund_requested','refund_approved','refund_rejected','refund_completed','refund_failed',
      'dispute_opened','dispute_updated','dispute_closed','dispute_evidence_uploaded',
      'refund_webhook_error',
      -- Sprint 6 Phase 6
      'finance_dashboard_viewed','finance_report_exported','finance_cache_refreshed'
    )
  );

GRANT SELECT ON public.finance_paid_payments_v TO authenticated;
GRANT SELECT ON public.finance_daily_revenue_v TO authenticated;
GRANT SELECT ON public.finance_monthly_revenue_v TO authenticated;
