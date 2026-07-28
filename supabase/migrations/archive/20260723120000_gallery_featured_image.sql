-- Featured work photo for provider gallery (optional profile richness).
ALTER TABLE public.images
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS images_provider_gallery_featured_idx
  ON public.images (provider_id)
  WHERE kind = 'gallery' AND deleted_at IS NULL AND is_featured = true;

COMMENT ON COLUMN public.images.is_featured IS
  'When true, gallery image is the featured work photo for the provider.';
