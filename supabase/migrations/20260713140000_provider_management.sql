-- Dalily AI — Provider Management (images, services, working hours, storage)

-- =============================================================================
-- IMAGES
-- =============================================================================

CREATE TABLE public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  bucket VARCHAR(100) NOT NULL DEFAULT 'provider-media',
  path TEXT NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('avatar', 'cover', 'gallery')),
  alt_text JSONB,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  mime_type VARCHAR(100),
  size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (bucket, path)
);

CREATE INDEX images_provider_kind_idx ON public.images (provider_id, kind) WHERE deleted_at IS NULL;

ALTER TABLE public.providers
  ADD CONSTRAINT providers_avatar_image_id_fkey
  FOREIGN KEY (avatar_image_id) REFERENCES public.images (id) ON DELETE SET NULL;

ALTER TABLE public.providers
  ADD CONSTRAINT providers_cover_image_id_fkey
  FOREIGN KEY (cover_image_id) REFERENCES public.images (id) ON DELETE SET NULL;

-- =============================================================================
-- PROVIDER SERVICES
-- =============================================================================

CREATE TABLE public.provider_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  name JSONB NOT NULL,
  description JSONB,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX provider_services_provider_idx
  ON public.provider_services (provider_id, sort_order)
  WHERE deleted_at IS NULL;

CREATE TRIGGER provider_services_updated_at
  BEFORE UPDATE ON public.provider_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- WORKING HOURS (0 = Sunday … 6 = Saturday)
-- =============================================================================

CREATE TABLE public.provider_working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME,
  closes_at TIME,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, day_of_week)
);

CREATE TRIGGER provider_working_hours_updated_at
  BEFORE UPDATE ON public.provider_working_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "images_owner_all" ON public.images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = images.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = images.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "images_public_gallery_read" ON public.images
  FOR SELECT
  USING (
    kind = 'gallery'
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = images.provider_id
        AND p.status = 'active'
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "provider_services_owner_all" ON public.provider_services
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_services.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_services.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "provider_services_public_read" ON public.provider_services
  FOR SELECT
  USING (
    is_active = true
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_services.provider_id
        AND p.status = 'active'
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "provider_working_hours_owner_all" ON public.provider_working_hours
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_working_hours.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_working_hours.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY "provider_working_hours_public_read" ON public.provider_working_hours
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_working_hours.provider_id
        AND p.status = 'active'
        AND p.deleted_at IS NULL
    )
  );

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-media',
  'provider-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "provider_media_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'provider-media');

CREATE POLICY "provider_media_owner_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'provider-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "provider_media_owner_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'provider-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "provider_media_owner_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'provider-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
