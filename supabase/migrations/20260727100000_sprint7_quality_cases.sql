-- Sprint 7 Phase 4 — Quality Assurance & Case Management
-- Structured quality cases; immutable status history; signed evidence.

CREATE TABLE IF NOT EXISTS public.quality_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL
    CHECK (category IN (
      'customer_complaint', 'provider_complaint', 'booking_issue',
      'service_quality', 'communication', 'damage_report',
      'late_arrival', 'no_show', 'policy_violation', 'other'
    )),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN (
      'open', 'pending_information', 'under_review',
      'waiting_for_provider', 'waiting_for_customer',
      'resolved', 'rejected', 'escalated', 'closed'
    )),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  opened_by_role TEXT NOT NULL
    CHECK (opened_by_role IN ('customer', 'provider', 'admin', 'system')),
  opened_by UUID,
  customer_id UUID,
  provider_id UUID REFERENCES public.providers(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  payment_id UUID,
  service_request_id UUID,
  review_id UUID,
  booking_issue_report_id UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resolution_summary TEXT,
  satisfaction_score SMALLINT CHECK (satisfaction_score IS NULL OR satisfaction_score BETWEEN 1 AND 5),
  assigned_admin_id UUID,
  escalated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  merged_into_case_id UUID REFERENCES public.quality_cases(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS quality_cases_status_idx
  ON public.quality_cases (status, priority, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS quality_cases_provider_idx
  ON public.quality_cases (provider_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS quality_cases_customer_idx
  ON public.quality_cases (customer_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS quality_cases_booking_idx
  ON public.quality_cases (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.quality_case_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.quality_cases(id) ON DELETE CASCADE,
  author_id UUID,
  author_role TEXT NOT NULL
    CHECK (author_role IN ('customer', 'provider', 'admin', 'system')),
  visibility TEXT NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('shared', 'internal')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quality_case_messages_case_idx
  ON public.quality_case_messages (case_id, created_at);

CREATE TABLE IF NOT EXISTS public.quality_case_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.quality_cases(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL
    CHECK (evidence_type IN (
      'photo', 'video', 'document', 'chat_reference',
      'booking_history', 'payment_reference', 'review_reference', 'other'
    )),
  uploaded_by UUID,
  bucket TEXT NOT NULL DEFAULT 'service-request-media',
  path TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  reference_id UUID,
  reference_label TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'hidden')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quality_case_evidence_case_idx
  ON public.quality_case_evidence (case_id, created_at);

CREATE TABLE IF NOT EXISTS public.quality_case_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.quality_cases(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT,
  action TEXT NOT NULL
    CHECK (action IN (
      'created', 'status_changed', 'assigned', 'unassigned',
      'escalated', 'merged', 'evidence_requested', 'resolved',
      'rejected', 'closed', 'reopened', 'note_added', 'priority_changed'
    )),
  actor_id UUID,
  actor_role TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quality_case_history_case_idx
  ON public.quality_case_history (case_id, created_at);

-- Immutable: no UPDATE/DELETE for non-service roles (enforced via revoke + RLS)
REVOKE UPDATE, DELETE ON public.quality_case_history FROM authenticated, anon;

CREATE TABLE IF NOT EXISTS public.quality_case_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.quality_cases(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  assigned_by UUID,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  note TEXT
);

CREATE INDEX IF NOT EXISTS quality_case_assignments_case_idx
  ON public.quality_case_assignments (case_id, assigned_at DESC);

CREATE TABLE IF NOT EXISTS public.quality_case_ai_analysis (
  case_id UUID PRIMARY KEY REFERENCES public.quality_cases(id) ON DELETE CASCADE,
  sentiment TEXT
    CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  severity NUMERIC(5,4) NOT NULL DEFAULT 0,
  urgency NUMERIC(5,4) NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  suggested_category TEXT,
  suggested_priority TEXT,
  suggested_resolution TEXT,
  repeated_pattern BOOLEAN NOT NULL DEFAULT false,
  pattern_notes TEXT,
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_version TEXT NOT NULL DEFAULT 'quality-heuristic-v1',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.quality_case_metrics (
  provider_id UUID PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  total_cases INTEGER NOT NULL DEFAULT 0,
  open_cases INTEGER NOT NULL DEFAULT 0,
  resolved_cases INTEGER NOT NULL DEFAULT 0,
  rejected_cases INTEGER NOT NULL DEFAULT 0,
  complaint_rate NUMERIC(8,4),
  resolution_rate NUMERIC(8,4),
  avg_resolution_hours NUMERIC(10,2),
  repeat_complaint_count INTEGER NOT NULL DEFAULT 0,
  avg_satisfaction NUMERIC(4,2),
  category_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  trend JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.quality_case_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.next_quality_case_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('public.quality_case_number_seq');
  RETURN 'QC-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::TEXT, 5, '0');
END;
$$;

ALTER TABLE public.quality_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_case_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_case_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_case_ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_case_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quality_cases_select ON public.quality_cases;
CREATE POLICY quality_cases_select ON public.quality_cases
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR customer_id = auth.uid()
    OR opened_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quality_cases_insert ON public.quality_cases;
CREATE POLICY quality_cases_insert ON public.quality_cases
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role('admin')
    OR opened_by = auth.uid()
  );

DROP POLICY IF EXISTS quality_messages_select ON public.quality_case_messages;
CREATE POLICY quality_messages_select ON public.quality_case_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR (
      visibility = 'shared'
      AND EXISTS (
        SELECT 1 FROM public.quality_cases c
        WHERE c.id = case_id
          AND (
            c.customer_id = auth.uid()
            OR c.opened_by = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.providers p
              WHERE p.id = c.provider_id AND p.owner_id = auth.uid()
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS quality_messages_insert ON public.quality_case_messages;
CREATE POLICY quality_messages_insert ON public.quality_case_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS quality_evidence_select ON public.quality_case_evidence;
CREATE POLICY quality_evidence_select ON public.quality_case_evidence
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.quality_cases c
      WHERE c.id = case_id
        AND (
          c.customer_id = auth.uid()
          OR c.opened_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = c.provider_id AND p.owner_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS quality_history_select ON public.quality_case_history;
CREATE POLICY quality_history_select ON public.quality_case_history
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.quality_cases c
      WHERE c.id = case_id
        AND (
          c.customer_id = auth.uid()
          OR c.opened_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = c.provider_id AND p.owner_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS quality_assignments_admin ON public.quality_case_assignments;
CREATE POLICY quality_assignments_admin ON public.quality_case_assignments
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS quality_ai_select ON public.quality_case_ai_analysis;
CREATE POLICY quality_ai_select ON public.quality_case_ai_analysis
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.quality_cases c
      WHERE c.id = case_id
        AND EXISTS (
          SELECT 1 FROM public.providers p
          WHERE p.id = c.provider_id AND p.owner_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS quality_metrics_select ON public.quality_case_metrics;
CREATE POLICY quality_metrics_select ON public.quality_case_metrics
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.quality_cases IS
  'Sprint 7 Phase 4 — marketplace quality / complaint cases.';
COMMENT ON TABLE public.quality_case_history IS
  'Immutable audit trail of quality case status/actions.';
