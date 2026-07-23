-- Sprint 41 — Admin Control Center 2.0
-- Extends moderation / broadcast / issue tracking. Does not alter Search/Booking/Reviews/Chat cores.

-- =============================================================================
-- BOOKING ISSUE MODERATION FIELDS
-- =============================================================================

ALTER TABLE public.booking_issue_reports
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'open'
    CHECK (moderation_status IN ('open', 'in_progress', 'resolved', 'closed')),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS booking_issue_reports_moderation_idx
  ON public.booking_issue_reports (moderation_status, created_at DESC)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- ADMIN BROADCASTS (history + schedule-ready)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  title_key TEXT,
  body_key TEXT,
  target TEXT NOT NULL DEFAULT 'all'
    CHECK (target IN ('all', 'providers', 'customers', 'single')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  href TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('draft', 'scheduled', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivery_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_broadcasts_created_idx
  ON public.admin_broadcasts (created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_broadcasts_admin_all ON public.admin_broadcasts;
CREATE POLICY admin_broadcasts_admin_all ON public.admin_broadcasts
  FOR ALL TO authenticated
  USING (public.has_role('admin') OR public.has_role('moderator'))
  WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));

-- =============================================================================
-- ADMIN ACTION LOG (flexible — avoids audit_action enum churn)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_action_logs_created_idx
  ON public.admin_action_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_action_logs_action_idx
  ON public.admin_action_logs (action, created_at DESC);

ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_action_logs_select ON public.admin_action_logs;
CREATE POLICY admin_action_logs_select ON public.admin_action_logs
  FOR SELECT TO authenticated
  USING (public.has_role('admin') OR public.has_role('moderator'));

DROP POLICY IF EXISTS admin_action_logs_insert ON public.admin_action_logs;
CREATE POLICY admin_action_logs_insert ON public.admin_action_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));
