-- Sprint 4 Phase 4 — Multi-Service Projects & AI Project Coordination

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
      -- Sprint 4 Phase 4
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
      'project_duration_compared'
    )
  );

CREATE TABLE IF NOT EXISTS public.service_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  root_service_request_id UUID NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN (
      'detected',
      'planning',
      'offers',
      'booked',
      'in_progress',
      'completed',
      'cancelled'
    )),
  city_id UUID,
  urgency TEXT,
  completion_pct INTEGER NOT NULL DEFAULT 0
    CHECK (completion_pct >= 0 AND completion_pct <= 100),
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  actual_duration_days NUMERIC,
  plan_version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_projects_customer_idx
  ON public.service_projects (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS service_projects_status_idx
  ON public.service_projects (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.project_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.service_projects(id) ON DELETE CASCADE,
  service_request_id UUID,
  trade_slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN (
      'planned',
      'matching',
      'offers',
      'booked',
      'blocked',
      'in_progress',
      'completed',
      'cancelled'
    )),
  depends_on_package_ids UUID[] NOT NULL DEFAULT '{}',
  assigned_provider_id UUID,
  estimated_days NUMERIC,
  actual_days NUMERIC,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  delay_hours NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, trade_slug)
);

CREATE INDEX IF NOT EXISTS project_packages_project_idx
  ON public.project_packages (project_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS project_packages_request_idx
  ON public.project_packages (service_request_id)
  WHERE service_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.project_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.service_projects(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.project_packages(id) ON DELETE SET NULL,
  event_key TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system'
    CHECK (actor IN ('system', 'customer', 'provider', 'admin', 'ai')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_timeline_events_project_idx
  ON public.project_timeline_events (project_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.service_projects(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.project_packages(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'photo'
    CHECK (kind IN ('photo', 'document', 'receipt', 'other')),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_documents_project_idx
  ON public.project_documents (project_id, created_at DESC);

-- Shared communication scopes (project-wide vs package-specific)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS package_id UUID,
  ADD COLUMN IF NOT EXISTS chat_scope TEXT NOT NULL DEFAULT 'request'
    CHECK (chat_scope IN ('request', 'project', 'package'));

CREATE INDEX IF NOT EXISTS conversations_project_idx
  ON public.conversations (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversations_package_idx
  ON public.conversations (package_id)
  WHERE package_id IS NOT NULL;

ALTER TABLE public.service_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_projects_customer ON public.service_projects;
CREATE POLICY service_projects_customer
  ON public.service_projects FOR SELECT
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS service_projects_admin ON public.service_projects;
CREATE POLICY service_projects_admin
  ON public.service_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS project_packages_customer ON public.project_packages;
CREATE POLICY project_packages_customer
  ON public.project_packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.service_projects p
      WHERE p.id = project_id AND p.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS project_packages_admin ON public.project_packages;
CREATE POLICY project_packages_admin
  ON public.project_packages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS project_timeline_customer ON public.project_timeline_events;
CREATE POLICY project_timeline_customer
  ON public.project_timeline_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.service_projects p
      WHERE p.id = project_id AND p.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS project_timeline_admin ON public.project_timeline_events;
CREATE POLICY project_timeline_admin
  ON public.project_timeline_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS project_documents_customer ON public.project_documents;
CREATE POLICY project_documents_customer
  ON public.project_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.service_projects p
      WHERE p.id = project_id AND p.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS project_documents_admin ON public.project_documents;
CREATE POLICY project_documents_admin
  ON public.project_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );
