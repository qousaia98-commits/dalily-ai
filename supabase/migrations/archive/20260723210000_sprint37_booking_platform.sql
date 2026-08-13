-- Sprint 37 — Booking & Scheduling Platform
-- Independent module. Does not alter Search / Diagnosis / Vision / Smart Map / Reviews / Chat core.

-- =============================================================================
-- BOOKINGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.provider_services(id) ON DELETE SET NULL,
  service_request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'confirmed', 'declined', 'cancelled',
      'completed', 'rescheduled', 'expired'
    )),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes IN (15, 30, 60, 90, 120)),
  timezone TEXT NOT NULL DEFAULT 'Asia/Damascus',
  location_text TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  customer_notes TEXT,
  provider_notes TEXT,
  preferred_contact TEXT
    CHECK (preferred_contact IS NULL OR preferred_contact IN ('chat', 'phone', 'whatsapp')),
  requires_provider_confirmation BOOLEAN NOT NULL DEFAULT true,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule TEXT,
  parent_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason TEXT,
  declined_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT bookings_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS bookings_provider_starts_idx
  ON public.bookings (provider_id, starts_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS bookings_customer_starts_idx
  ON public.bookings (customer_id, starts_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS bookings_status_idx
  ON public.bookings (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS bookings_request_idx
  ON public.bookings (service_request_id)
  WHERE service_request_id IS NOT NULL AND deleted_at IS NULL;

-- Prevent overlapping active bookings for the same provider
CREATE OR REPLACE FUNCTION public.bookings_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('declined', 'cancelled', 'expired') THEN
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

DROP TRIGGER IF EXISTS trg_bookings_no_overlap ON public.bookings;
CREATE TRIGGER trg_bookings_no_overlap
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, status, deleted_at
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_no_overlap();

CREATE OR REPLACE FUNCTION public.touch_booking_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.touch_booking_updated_at();

-- =============================================================================
-- AVAILABILITY (extends weekly hours with breaks / emergency / timezone)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.provider_availability_settings (
  provider_id UUID PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Damascus',
  slot_durations INT[] NOT NULL DEFAULT ARRAY[30, 60],
  buffer_minutes INT NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0 AND buffer_minutes <= 120),
  min_notice_hours INT NOT NULL DEFAULT 2 CHECK (min_notice_hours >= 0),
  max_days_ahead INT NOT NULL DEFAULT 60 CHECK (max_days_ahead BETWEEN 1 AND 365),
  emergency_available BOOLEAN NOT NULL DEFAULT false,
  accepting_bookings BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_availability_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  label TEXT,
  CONSTRAINT breaks_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS provider_availability_breaks_provider_idx
  ON public.provider_availability_breaks (provider_id, day_of_week);

-- =============================================================================
-- BLOCKED TIMES / VACATION / MANUAL UNAVAILABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.provider_blocked_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  kind TEXT NOT NULL DEFAULT 'blocked'
    CHECK (kind IN ('blocked', 'vacation', 'holiday', 'manual')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT blocked_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS provider_blocked_times_range_idx
  ON public.provider_blocked_times (provider_id, starts_at, ends_at)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- BOOKING NOTES / ATTACHMENTS / HISTORY
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.booking_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.booking_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL DEFAULT 'booking-attachments',
  path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.booking_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_status_log_booking_idx
  ON public.booking_status_log (booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.booking_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL
    CHECK (reminder_type IN ('24h', '2h', '1h', 'custom')),
  channel TEXT NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'push')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.booking_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'booking_created',
      'booking_accepted',
      'booking_declined',
      'booking_cancelled',
      'booking_completed',
      'booking_rescheduled',
      'booking_expired'
    )),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  provider_id UUID,
  actor_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_analytics_events_type_idx
  ON public.booking_analytics_events (event_type, created_at DESC);

-- Status audit trigger
CREATE OR REPLACE FUNCTION public.log_booking_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_status_log (booking_id, from_status, to_status, actor_id)
    VALUES (NEW.id, NULL, NEW.status, NEW.customer_id);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_status_log (booking_id, from_status, to_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_booking_status ON public.bookings;
CREATE TRIGGER trg_log_booking_status
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.log_booking_status_change();

-- =============================================================================
-- HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_booking_participant(p_booking_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.providers pr ON pr.id = b.provider_id
    WHERE b.id = p_booking_id
      AND b.deleted_at IS NULL
      AND (b.customer_id = p_user_id OR pr.owner_id = p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_provider_owner(p_provider_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers
    WHERE id = p_provider_id AND owner_id = p_user_id
  );
$$;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_availability_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_availability_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bookings_select ON public.bookings;
CREATE POLICY bookings_select ON public.bookings
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      customer_id = auth.uid()
      OR public.is_provider_owner(provider_id, auth.uid())
      OR public.has_role('admin')
      OR public.has_role('moderator')
    )
  );

DROP POLICY IF EXISTS bookings_insert_customer ON public.bookings;
CREATE POLICY bookings_insert_customer ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS bookings_update_participants ON public.bookings;
CREATE POLICY bookings_update_participants ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    customer_id = auth.uid()
    OR public.is_provider_owner(provider_id, auth.uid())
    OR public.has_role('admin')
  )
  WITH CHECK (
    customer_id = auth.uid()
    OR public.is_provider_owner(provider_id, auth.uid())
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS availability_settings_select ON public.provider_availability_settings;
CREATE POLICY availability_settings_select ON public.provider_availability_settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS availability_settings_owner ON public.provider_availability_settings;
CREATE POLICY availability_settings_owner ON public.provider_availability_settings
  FOR ALL TO authenticated
  USING (public.is_provider_owner(provider_id, auth.uid()))
  WITH CHECK (public.is_provider_owner(provider_id, auth.uid()));

DROP POLICY IF EXISTS availability_breaks_select ON public.provider_availability_breaks;
CREATE POLICY availability_breaks_select ON public.provider_availability_breaks
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS availability_breaks_owner ON public.provider_availability_breaks;
CREATE POLICY availability_breaks_owner ON public.provider_availability_breaks
  FOR ALL TO authenticated
  USING (public.is_provider_owner(provider_id, auth.uid()))
  WITH CHECK (public.is_provider_owner(provider_id, auth.uid()));

DROP POLICY IF EXISTS blocked_times_select ON public.provider_blocked_times;
CREATE POLICY blocked_times_select ON public.provider_blocked_times
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

DROP POLICY IF EXISTS blocked_times_owner ON public.provider_blocked_times;
CREATE POLICY blocked_times_owner ON public.provider_blocked_times
  FOR ALL TO authenticated
  USING (public.is_provider_owner(provider_id, auth.uid()))
  WITH CHECK (public.is_provider_owner(provider_id, auth.uid()));

DROP POLICY IF EXISTS booking_notes_select ON public.booking_notes;
CREATE POLICY booking_notes_select ON public.booking_notes
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_booking_participant(booking_id, auth.uid())
    AND (is_internal = false OR EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.providers pr ON pr.id = b.provider_id
      WHERE b.id = booking_id AND pr.owner_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS booking_notes_insert ON public.booking_notes;
CREATE POLICY booking_notes_insert ON public.booking_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND public.is_booking_participant(booking_id, auth.uid())
  );

DROP POLICY IF EXISTS booking_attachments_select ON public.booking_attachments;
CREATE POLICY booking_attachments_select ON public.booking_attachments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_booking_participant(booking_id, auth.uid())
  );

DROP POLICY IF EXISTS booking_attachments_insert ON public.booking_attachments;
CREATE POLICY booking_attachments_insert ON public.booking_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND public.is_booking_participant(booking_id, auth.uid())
  );

DROP POLICY IF EXISTS booking_status_log_select ON public.booking_status_log;
CREATE POLICY booking_status_log_select ON public.booking_status_log
  FOR SELECT TO authenticated
  USING (public.is_booking_participant(booking_id, auth.uid()) OR public.has_role('admin'));

DROP POLICY IF EXISTS booking_reminder_log_select ON public.booking_reminder_log;
CREATE POLICY booking_reminder_log_select ON public.booking_reminder_log
  FOR SELECT TO authenticated
  USING (public.is_booking_participant(booking_id, auth.uid()) OR public.has_role('admin'));

DROP POLICY IF EXISTS booking_analytics_admin ON public.booking_analytics_events;
CREATE POLICY booking_analytics_admin ON public.booking_analytics_events
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

-- =============================================================================
-- STORAGE
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'booking-attachments',
  'booking-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS booking_attachments_storage_insert ON storage.objects;
CREATE POLICY booking_attachments_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'booking-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS booking_attachments_storage_select ON storage.objects;
CREATE POLICY booking_attachments_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'booking-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role('admin')
    )
  );

-- =============================================================================
-- REALTIME
-- =============================================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_blocked_times;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_availability_settings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
