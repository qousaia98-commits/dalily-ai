-- Sprint 4 Phase 5 — Recurring Services & Maintenance Plans

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
      -- Sprint 4 Phase 5
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
      'maintenance_due_detected'
    )
  );

CREATE TABLE IF NOT EXISTS public.recurring_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  provider_id UUID,
  category_slug TEXT,
  service_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  interval_kind TEXT NOT NULL
    CHECK (interval_kind IN (
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'semiannual',
      'yearly',
      'custom'
    )),
  custom_interval_days INTEGER
    CHECK (custom_interval_days IS NULL OR (custom_interval_days >= 1 AND custom_interval_days <= 730)),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft', 'active', 'paused', 'cancelled', 'expired')),
  start_date DATE NOT NULL,
  end_date DATE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  preferred_weekdays INTEGER[] NOT NULL DEFAULT '{}',
  preferred_time_start TIME,
  preferred_time_end TIME,
  duration_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (duration_minutes IN (30, 60, 90, 120, 180, 240)),
  timezone TEXT NOT NULL DEFAULT 'Asia/Damascus',
  location_text TEXT,
  emergency_contact TEXT,
  notes TEXT,
  next_visit_at TIMESTAMPTZ,
  last_visit_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  renew_count INTEGER NOT NULL DEFAULT 0,
  completed_visit_count INTEGER NOT NULL DEFAULT 0,
  skipped_visit_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_plans_customer_idx
  ON public.recurring_plans (customer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS recurring_plans_provider_idx
  ON public.recurring_plans (provider_id, status)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS recurring_plans_next_visit_idx
  ON public.recurring_plans (next_visit_at)
  WHERE status = 'active' AND next_visit_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.maintenance_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL UNIQUE REFERENCES public.recurring_plans(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  provider_id UUID,
  contract_start DATE NOT NULL,
  contract_end DATE,
  auto_renew BOOLEAN NOT NULL DEFAULT true,
  preferred_weekdays INTEGER[] NOT NULL DEFAULT '{}',
  preferred_time_start TIME,
  preferred_time_end TIME,
  emergency_contact TEXT,
  terms_notes TEXT,
  renewal_notice_days INTEGER NOT NULL DEFAULT 14,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recurring_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.recurring_plans(id) ON DELETE CASCADE,
  booking_id UUID,
  sequence_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN (
      'scheduled',
      'confirmed',
      'skipped',
      'rescheduled',
      'completed',
      'cancelled',
      'missed'
    )),
  planned_starts_at TIMESTAMPTZ NOT NULL,
  planned_ends_at TIMESTAMPTZ NOT NULL,
  actual_starts_at TIMESTAMPTZ,
  actual_ends_at TIMESTAMPTZ,
  skip_reason TEXT,
  reschedule_note TEXT,
  reminder_sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_visits_plan_idx
  ON public.recurring_visits (plan_id, planned_starts_at ASC);

CREATE INDEX IF NOT EXISTS recurring_visits_status_idx
  ON public.recurring_visits (status, planned_starts_at);

CREATE TABLE IF NOT EXISTS public.recurring_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  provider_id UUID,
  category_slug TEXT,
  suggested_interval TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  reason_en TEXT NOT NULL,
  reason_ar TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  based_on_booking_ids UUID[] NOT NULL DEFAULT '{}',
  created_plan_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS recurring_recommendations_customer_idx
  ON public.recurring_recommendations (customer_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.recurring_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.recurring_plans(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.recurring_visits(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL
    CHECK (reminder_type IN (
      'upcoming_visit',
      'plan_renewal',
      'visit_skipped',
      'plan_paused',
      'plan_cancelled',
      'maintenance_due'
    )),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, visit_id, reminder_type)
);

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS recurring_plan_id UUID,
  ADD COLUMN IF NOT EXISTS recurring_visit_id UUID;

CREATE INDEX IF NOT EXISTS bookings_recurring_plan_idx
  ON public.bookings (recurring_plan_id)
  WHERE recurring_plan_id IS NOT NULL;

ALTER TABLE public.recurring_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recurring_plans_customer ON public.recurring_plans;
CREATE POLICY recurring_plans_customer
  ON public.recurring_plans FOR SELECT
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS recurring_plans_admin ON public.recurring_plans;
CREATE POLICY recurring_plans_admin
  ON public.recurring_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin' AND revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS maintenance_contracts_customer ON public.maintenance_contracts;
CREATE POLICY maintenance_contracts_customer
  ON public.maintenance_contracts FOR SELECT
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS recurring_visits_customer ON public.recurring_visits;
CREATE POLICY recurring_visits_customer
  ON public.recurring_visits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recurring_plans p
      WHERE p.id = plan_id AND p.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS recurring_recommendations_customer ON public.recurring_recommendations;
CREATE POLICY recurring_recommendations_customer
  ON public.recurring_recommendations FOR SELECT
  USING (customer_id = auth.uid());
