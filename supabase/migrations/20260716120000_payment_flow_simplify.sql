-- Sprint 14 — Simplified manual payment flow
-- Unique stored payment reference, receipt upload, review statuses

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS receipt_path TEXT,
  ADD COLUMN IF NOT EXISTS receipt_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Backfill immutable references for existing rows (never regenerated afterwards)
UPDATE public.payments
SET payment_reference = 'DAL-' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE payment_reference IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN payment_reference SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_payment_reference_uidx
  ON public.payments (payment_reference);

CREATE INDEX IF NOT EXISTS payments_submitted_at_idx
  ON public.payments (submitted_at DESC NULLS LAST);

-- Private storage for payment receipts (PDF / JPG / PNG, max 10 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-receipts',
  'payment-receipts',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "payment_receipts_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "payment_receipts_admin_delete" ON storage.objects;

CREATE POLICY "payment_receipts_owner_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "payment_receipts_owner_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "payment_receipts_owner_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "payment_receipts_admin_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (public.has_role('admin') OR public.has_role('moderator'))
  );

CREATE POLICY "payment_receipts_admin_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'payment-receipts'
    AND (public.has_role('admin') OR public.has_role('moderator'))
  );
