-- Sprint 38 — Service Completion & Review Flow
-- Final booking lifecycle layer. Does not alter Search / Diagnosis / Vision / Smart Map / Reviews / Chat core.

-- =============================================================================
-- EXTEND BOOKING STATUSES
-- =============================================================================

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check CHECK (status IN (
    'pending',
    'confirmed',
    'declined',
    'cancelled',
    'completed',
    'rescheduled',
    'expired',
    'awaiting_customer_confirmation',
    'customer_confirmed',
    'issue_reported'
  ));

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_prompted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS issue_reason TEXT,
  ADD COLUMN IF NOT EXISTS issue_reported_at TIMESTAMPTZ;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_issue_reason_check;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_issue_reason_check CHECK (
    issue_reason IS NULL OR issue_reason IN (
      'provider_never_arrived',
      'provider_cancelled',
      'work_incomplete',
      'poor_quality',
      'need_another_visit',
      'other'
    )
  );

-- Overlap: only active future-ish statuses block slots
CREATE OR REPLACE FUNCTION public.bookings_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('pending', 'confirmed', 'rescheduled') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.provider_id = NEW.provider_id
      AND b.deleted_at IS NULL
      AND b.id IS DISTINCT FROM NEW.id
      AND b.status IN ('pending', 'confirmed', 'rescheduled')
      AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'booking_overlap';
  END IF;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- ISSUE REPORTS (predefined reasons, soft delete)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.booking_issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  reason TEXT NOT NULL
    CHECK (reason IN (
      'provider_never_arrived',
      'provider_cancelled',
      'work_incomplete',
      'poor_quality',
      'need_another_visit',
      'other'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS booking_issue_reports_booking_idx
  ON public.booking_issue_reports (booking_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS booking_issue_reports_provider_idx
  ON public.booking_issue_reports (provider_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- REMINDER LOG: completion_prompt channel types
-- =============================================================================

ALTER TABLE public.booking_reminder_log DROP CONSTRAINT IF EXISTS booking_reminder_log_reminder_type_check;
ALTER TABLE public.booking_reminder_log
  ADD CONSTRAINT booking_reminder_log_reminder_type_check CHECK (
    reminder_type IN ('24h', '2h', '1h', 'custom', 'completion_prompt')
  );

-- =============================================================================
-- ANALYTICS EVENTS
-- =============================================================================

ALTER TABLE public.booking_analytics_events DROP CONSTRAINT IF EXISTS booking_analytics_events_event_type_check;
ALTER TABLE public.booking_analytics_events
  ADD CONSTRAINT booking_analytics_events_event_type_check CHECK (event_type IN (
    'booking_created',
    'booking_accepted',
    'booking_declined',
    'booking_cancelled',
    'booking_completed',
    'booking_rescheduled',
    'booking_expired',
    'completion_confirmed',
    'issue_reported',
    'review_submitted',
    'completion_prompt_sent'
  ));

-- =============================================================================
-- PROMOTE DUE BOOKINGS → awaiting_customer_confirmation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.promote_bookings_awaiting_confirmation()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT := 0;
BEGIN
  WITH due AS (
    UPDATE public.bookings b
    SET
      status = 'awaiting_customer_confirmation',
      completion_prompted_at = COALESCE(b.completion_prompted_at, now()),
      updated_at = now()
    WHERE b.deleted_at IS NULL
      AND b.status = 'confirmed'
      AND b.ends_at <= now()
    RETURNING b.id
  )
  SELECT COUNT(*)::INT INTO updated_count FROM due;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_bookings_awaiting_confirmation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_bookings_awaiting_confirmation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_bookings_awaiting_confirmation() TO service_role;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.booking_issue_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_issue_reports_select ON public.booking_issue_reports;
CREATE POLICY booking_issue_reports_select ON public.booking_issue_reports
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      customer_id = auth.uid()
      OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid() AND deleted_at IS NULL)
      OR public.has_role('admin')
      OR public.has_role('moderator')
    )
  );

DROP POLICY IF EXISTS booking_issue_reports_insert ON public.booking_issue_reports;
CREATE POLICY booking_issue_reports_insert ON public.booking_issue_reports
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS booking_issue_reports_soft_delete ON public.booking_issue_reports;
CREATE POLICY booking_issue_reports_soft_delete ON public.booking_issue_reports
  FOR UPDATE TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.has_role('admin')
    OR public.has_role('moderator')
  )
  WITH CHECK (true);
