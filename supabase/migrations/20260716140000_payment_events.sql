-- Sprint 14.1 — Payment action history for admin timeline

CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments (id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  actor_id UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_events_payment_id_idx
  ON public.payment_events (payment_id, created_at ASC);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_events_select_admin" ON public.payment_events;

CREATE POLICY "payment_events_select_admin" ON public.payment_events
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('admin') OR public.has_role('moderator')
  );

-- Backfill timeline from existing payment timestamps
INSERT INTO public.payment_events (payment_id, event_type, actor_id, note, created_at)
SELECT id, 'requested', NULL, NULL, created_at
FROM public.payments
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_events pe WHERE pe.payment_id = payments.id AND pe.event_type = 'requested'
);

INSERT INTO public.payment_events (payment_id, event_type, actor_id, note, created_at)
SELECT id, 'receipt_uploaded', NULL, NULL, submitted_at
FROM public.payments
WHERE submitted_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_events pe WHERE pe.payment_id = payments.id AND pe.event_type = 'receipt_uploaded'
  );

INSERT INTO public.payment_events (payment_id, event_type, actor_id, note, created_at)
SELECT id, 'approved', approved_by, NULL, approved_at
FROM public.payments
WHERE approved_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_events pe WHERE pe.payment_id = payments.id AND pe.event_type = 'approved'
  );

INSERT INTO public.payment_events (payment_id, event_type, actor_id, note, created_at)
SELECT id, 'rejected', rejected_by, admin_note, rejected_at
FROM public.payments
WHERE rejected_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_events pe WHERE pe.payment_id = payments.id AND pe.event_type = 'rejected'
  );
