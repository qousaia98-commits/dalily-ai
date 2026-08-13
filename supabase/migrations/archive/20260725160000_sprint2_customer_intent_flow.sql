-- Sprint 2 — Customer Intent Flow (additive)
-- Enables marketplace-native requests without a pre-selected provider.
-- Legacy RFQ rows (lifecycle_version = 1) still require provider_id.

ALTER TABLE public.service_requests
  ALTER COLUMN provider_id DROP NOT NULL;

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_provider_lifecycle_chk;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_provider_lifecycle_chk
  CHECK (
    (COALESCE(lifecycle_version, 1) = 1 AND provider_id IS NOT NULL)
    OR (COALESCE(lifecycle_version, 1) >= 2)
  );

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS category_id uuid NULL REFERENCES public.categories (id) ON DELETE SET NULL;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS urgency text NULL
    CHECK (urgency IS NULL OR urgency IN ('emergency', 'normal'));

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS city_id uuid NULL REFERENCES public.cities (id) ON DELETE SET NULL;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS intent_text text NULL;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS category_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS published_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS service_requests_v2_matching_idx
  ON public.service_requests (lifecycle_version, status, category_id, city_id, created_at DESC)
  WHERE lifecycle_version >= 2 AND provider_id IS NULL;

COMMENT ON COLUMN public.service_requests.intent_text IS
  'Dalily 2.0 customer intent (Sprint 2). May mirror description.';
COMMENT ON COLUMN public.service_requests.urgency IS
  'emergency | normal — auto-classified then confirmed when emergency hypothesized.';
COMMENT ON COLUMN public.service_requests.category_id IS
  'Confirmed category for matching (Sprint 3).';
