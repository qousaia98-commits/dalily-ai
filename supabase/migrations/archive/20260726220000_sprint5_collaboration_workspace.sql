-- Sprint 5 Phase 5 — Collaboration Workspace

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
      -- Sprint 5 Phase 5
      'collab_workspace_opened','collab_task_created','collab_task_updated','collab_task_completed',
      'collab_checklist_created','collab_checklist_item_toggled','collab_checklist_completed',
      'collab_approval_requested','collab_approval_accepted','collab_approval_rejected',
      'collab_document_versioned','collab_activity_logged','collab_ai_summary_generated',
      'collab_ai_recommendation_accepted','collab_ai_recommendation_ignored'
    )
  );

-- Shared tasks
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.service_projects(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.project_packages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'blocked', 'completed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_at TIMESTAMPTZ,
  assigned_user_id UUID,
  assigned_role TEXT
    CHECK (assigned_role IS NULL OR assigned_role IN ('customer', 'provider', 'admin', 'either')),
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_by UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS project_tasks_project_idx
  ON public.project_tasks (project_id, status, due_at)
  WHERE deleted_at IS NULL;

-- Checklist templates + instances
CREATE TABLE IF NOT EXISTS public.project_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.service_projects(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.project_packages(id) ON DELETE SET NULL,
  template_slug TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed')),
  created_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.project_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.project_checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  done_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_checklists_project_idx
  ON public.project_checklists (project_id)
  WHERE deleted_at IS NULL;

-- Approvals
CREATE TABLE IF NOT EXISTS public.project_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.service_projects(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.project_packages(id) ON DELETE SET NULL,
  kind TEXT NOT NULL
    CHECK (kind IN (
      'quotation', 'package_completed', 'additional_work', 'final_completion', 'other'
    )),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by UUID,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_approvals_project_idx
  ON public.project_approvals (project_id, status, created_at DESC);

-- Document version history
CREATE TABLE IF NOT EXISTS public.project_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.project_documents(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.service_projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT NOT NULL,
  bucket TEXT NOT NULL DEFAULT 'project-media',
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  change_note TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_number)
);

ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS doc_category TEXT
    CHECK (doc_category IS NULL OR doc_category IN (
      'invoice', 'contract', 'certificate', 'manual', 'guarantee', 'signed', 'other'
    )),
  ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1;

-- Unified activity feed (chronological workspace stream)
CREATE TABLE IF NOT EXISTS public.project_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.service_projects(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.project_packages(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system'
    CHECK (actor IN ('system', 'customer', 'provider', 'admin', 'ai')),
  actor_user_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_activity_events_project_idx
  ON public.project_activity_events (project_id, created_at DESC);

-- Seed reusable checklist templates
INSERT INTO public.project_checklist_templates (slug, title_en, title_ar, items)
VALUES
  (
    'bathroom_renovation',
    'Bathroom renovation',
    'تجديد الحمام',
    '[
      {"title":"Protect floors and fixtures"},
      {"title":"Remove old tiles / fittings"},
      {"title":"Plumbing rough-in"},
      {"title":"Waterproofing"},
      {"title":"Tile installation"},
      {"title":"Fixtures and final clean"}
    ]'::jsonb
  ),
  (
    'kitchen_installation',
    'Kitchen installation',
    'تركيب المطبخ',
    '[
      {"title":"Measure and confirm layout"},
      {"title":"Cabinets installed"},
      {"title":"Countertop fitted"},
      {"title":"Plumbing connected"},
      {"title":"Electrical outlets checked"},
      {"title":"Final walkthrough"}
    ]'::jsonb
  ),
  (
    'electrical_inspection',
    'Electrical inspection',
    'فحص كهربائي',
    '[
      {"title":"Power isolated safely"},
      {"title":"Panel and breakers checked"},
      {"title":"Wiring / grounding verified"},
      {"title":"Outlets and switches tested"},
      {"title":"Report shared with customer"}
    ]'::jsonb
  ),
  (
    'cleaning_service',
    'Cleaning service',
    'خدمة تنظيف',
    '[
      {"title":"Rooms dusted and vacuumed"},
      {"title":"Kitchen surfaces cleaned"},
      {"title":"Bathrooms sanitized"},
      {"title":"Floors mopped"},
      {"title":"Trash removed"}
    ]'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;

-- Helper: project access for RLS
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.service_projects sp
    WHERE sp.id = p_project_id AND sp.customer_id = p_user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.project_packages pp
    JOIN public.providers pr ON pr.id = pp.assigned_provider_id
    WHERE pp.project_id = p_project_id AND pr.owner_id = p_user_id
  )
  OR public.has_role('admin');
$$;

-- RLS
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_checklist_templates_read ON public.project_checklist_templates;
CREATE POLICY project_checklist_templates_read ON public.project_checklist_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS project_tasks_member_all ON public.project_tasks;
CREATE POLICY project_tasks_member_all ON public.project_tasks
  FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS project_checklists_member_all ON public.project_checklists;
CREATE POLICY project_checklists_member_all ON public.project_checklists
  FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS project_checklist_items_member_all ON public.project_checklist_items;
CREATE POLICY project_checklist_items_member_all ON public.project_checklist_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.project_checklists c
      WHERE c.id = checklist_id AND public.is_project_member(c.project_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_checklists c
      WHERE c.id = checklist_id AND public.is_project_member(c.project_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS project_approvals_member_all ON public.project_approvals;
CREATE POLICY project_approvals_member_all ON public.project_approvals
  FOR ALL TO authenticated
  USING (public.is_project_member(project_id, auth.uid()))
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS project_doc_versions_member_select ON public.project_document_versions;
CREATE POLICY project_doc_versions_member_select ON public.project_document_versions
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS project_doc_versions_member_insert ON public.project_document_versions;
CREATE POLICY project_doc_versions_member_insert ON public.project_document_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS project_activity_member_select ON public.project_activity_events;
CREATE POLICY project_activity_member_select ON public.project_activity_events
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS project_activity_member_insert ON public.project_activity_events;
CREATE POLICY project_activity_member_insert ON public.project_activity_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

COMMENT ON TABLE public.project_tasks IS
  'Sprint 5 Phase 5 — shared collaboration tasks. AI never mutates these automatically.';
COMMENT ON TABLE public.project_approvals IS
  'Sprint 5 Phase 5 — customer/provider approval workflow.';
COMMENT ON TABLE public.project_activity_events IS
  'Sprint 5 Phase 5 — chronological collaboration activity feed.';
