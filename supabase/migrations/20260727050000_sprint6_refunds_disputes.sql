-- Sprint 6 Phase 5 — Refunds & Disputes

-- Track cumulative refunds on payments (paid status stays; never rewrite to failed)
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_status TEXT
    CHECK (refund_status IS NULL OR refund_status IN (
      'none', 'partial', 'full', 'pending'
    ));

UPDATE public.payments
  SET refund_status = COALESCE(refund_status, 'none')
  WHERE refund_status IS NULL;

-- Refund requests
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  refund_type TEXT NOT NULL
    CHECK (refund_type IN ('full', 'partial', 'manual', 'automatic')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested', 'pending', 'approved', 'rejected',
      'processing', 'succeeded', 'failed', 'cancelled'
    )),
  original_amount NUMERIC(12,2) NOT NULL,
  refund_amount NUMERIC(12,2) NOT NULL,
  remaining_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT NOT NULL DEFAULT '',
  requested_by UUID,
  approved_by UUID,
  rejected_by UUID,
  rejection_reason TEXT,
  stripe_refund_id TEXT,
  payment_reference TEXT,
  financial_document_id UUID,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (refund_amount > 0),
  CHECK (refund_amount <= original_amount),
  CHECK (remaining_amount >= 0)
);

CREATE INDEX IF NOT EXISTS refund_requests_payment_idx
  ON public.refund_requests (payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS refund_requests_provider_idx
  ON public.refund_requests (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS refund_requests_status_idx
  ON public.refund_requests (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS refund_requests_stripe_uidx
  ON public.refund_requests (stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;

-- Immutable refund status transitions
CREATE TABLE IF NOT EXISTS public.refund_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id UUID NOT NULL REFERENCES public.refund_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id UUID,
  source TEXT NOT NULL DEFAULT 'system'
    CHECK (source IN ('system', 'admin', 'provider', 'webhook', 'stripe')),
  note TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refund_history_refund_idx
  ON public.refund_history (refund_request_id, created_at ASC);

-- Payment disputes (Stripe chargebacks etc.)
CREATE TABLE IF NOT EXISTS public.payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  stripe_dispute_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  status TEXT NOT NULL DEFAULT 'opened'
    CHECK (status IN (
      'opened', 'evidence_requested', 'evidence_submitted',
      'under_review', 'won', 'lost', 'closed'
    )),
  reason TEXT,
  amount NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  evidence_due_by TIMESTAMPTZ,
  resolution TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_disputes_payment_idx
  ON public.payment_disputes (payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_disputes_status_idx
  ON public.payment_disputes (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES public.payment_disputes(id) ON DELETE CASCADE,
  uploaded_by UUID,
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispute_evidence_dispute_idx
  ON public.dispute_evidence (dispute_id, created_at DESC);

-- Credit note metadata (links CRN PDF to refund + original document)
CREATE TABLE IF NOT EXISTS public.credit_note_metadata (
  document_id UUID PRIMARY KEY REFERENCES public.financial_documents(id) ON DELETE CASCADE,
  refund_request_id UUID REFERENCES public.refund_requests(id) ON DELETE SET NULL,
  original_document_id UUID REFERENCES public.financial_documents(id) ON DELETE SET NULL,
  original_document_number TEXT,
  refund_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refund_requests_own ON public.refund_requests;
CREATE POLICY refund_requests_own ON public.refund_requests
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS refund_history_own ON public.refund_history;
CREATE POLICY refund_history_own ON public.refund_history
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.refund_requests r
      JOIN public.providers p ON p.id = r.provider_id
      WHERE r.id = refund_request_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS payment_disputes_own ON public.payment_disputes;
CREATE POLICY payment_disputes_own ON public.payment_disputes
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS dispute_evidence_own ON public.dispute_evidence;
CREATE POLICY dispute_evidence_own ON public.dispute_evidence
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.payment_disputes d
      JOIN public.providers p ON p.id = d.provider_id
      WHERE d.id = dispute_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS credit_note_meta_own ON public.credit_note_metadata;
CREATE POLICY credit_note_meta_own ON public.credit_note_metadata
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.financial_documents fd
      JOIN public.providers p ON p.id = fd.provider_id
      WHERE fd.id = document_id AND p.owner_id = auth.uid()
    )
  );

-- Learning events (append Phase 5)
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
      -- Sprint 6 Phase 5
      'refund_requested','refund_approved','refund_rejected','refund_completed','refund_failed',
      'dispute_opened','dispute_updated','dispute_closed','dispute_evidence_uploaded',
      'refund_webhook_error'
    )
  );

COMMENT ON TABLE public.refund_requests IS
  'Sprint 6 Phase 5 — refund requests (full/partial/manual).';
COMMENT ON TABLE public.payment_disputes IS
  'Sprint 6 Phase 5 — Stripe/payment disputes.';

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'refund_approved';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'refund_rejected';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'dispute_evidence_uploaded';
