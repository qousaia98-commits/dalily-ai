-- Dalily AI — Provider identity verification (Sprint 5)

CREATE TYPE public.provider_verification_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.provider_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL UNIQUE REFERENCES public.providers (id) ON DELETE CASCADE,
  id_front_url TEXT,
  id_back_url TEXT,
  selfie_url TEXT,
  status public.provider_verification_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX provider_verifications_status_idx
  ON public.provider_verifications (status);

CREATE TRIGGER provider_verifications_updated_at
  BEFORE UPDATE ON public.provider_verifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.provider_verifications ENABLE ROW LEVEL SECURITY;

-- Business: read own provider verification
CREATE POLICY "provider_verifications_select_own" ON public.provider_verifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_verifications.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

-- Business: insert verification for own provider
CREATE POLICY "provider_verifications_insert_own" ON public.provider_verifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_verifications.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

-- Business: update own verification when rejected (resubmit) or while uploading docs
CREATE POLICY "provider_verifications_update_own" ON public.provider_verifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_verifications.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    AND (
      provider_verifications.status = 'rejected'
      OR (
        provider_verifications.status = 'pending'
        AND provider_verifications.reviewed_at IS NULL
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_verifications.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

-- Admins: read all verifications
CREATE POLICY "provider_verifications_select_admin" ON public.provider_verifications
  FOR SELECT
  USING (public.has_role('admin') OR public.has_role('moderator'));

-- Admins: approve / reject
CREATE POLICY "provider_verifications_update_admin" ON public.provider_verifications
  FOR UPDATE
  USING (public.has_role('admin') OR public.has_role('moderator'))
  WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));

-- =============================================================================
-- PRIVATE STORAGE BUCKET (verification documents)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-verification',
  'provider-verification',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Business: upload to own folder only
CREATE POLICY "provider_verification_owner_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'provider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins: download verification documents
CREATE POLICY "provider_verification_admin_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'provider-verification'
    AND (public.has_role('admin') OR public.has_role('moderator'))
  );

-- Admins: delete if needed
CREATE POLICY "provider_verification_admin_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'provider-verification'
    AND (public.has_role('admin') OR public.has_role('moderator'))
  );

-- Business: replace own files on resubmit
CREATE POLICY "provider_verification_owner_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'provider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "provider_verification_owner_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'provider-verification'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
