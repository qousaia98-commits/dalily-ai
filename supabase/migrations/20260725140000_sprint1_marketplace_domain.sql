-- Sprint 1 — Marketplace Domain (additive only)
-- Prepares SAD Marketplace ownership columns + projection/selection placeholders.
-- Does NOT drop or alter legacy service_request_status enum values.
-- Safe to apply while MARKETPLACE_DOMAIN_V2 defaults to off.

-- Lifecycle markers on legacy request rows (v1 = legacy RFQ; v2 = marketplace-native later)
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS lifecycle_version smallint NOT NULL DEFAULT 1;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS selection_id uuid NULL;

COMMENT ON COLUMN public.service_requests.lifecycle_version IS
  'Dalily 2.0: 1=legacy RFQ row, 2=marketplace-native (future). Sprint 1 additive.';
COMMENT ON COLUMN public.service_requests.selection_id IS
  'Dalily 2.0: FK placeholder to marketplace_selections (Sprint 4/5). Nullable until unlock flow.';

-- Selection aggregate placeholder (owned by Marketplace; Offer/Unlock fill later)
CREATE TABLE IF NOT EXISTS public.marketplace_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  provider_id uuid NULL REFERENCES public.providers (id) ON DELETE SET NULL,
  offer_id uuid NULL,
  status text NOT NULL DEFAULT 'pending_unlock'
    CHECK (status IN ('pending_unlock', 'unlocked', 'declined', 'timed_out', 'superseded')),
  selected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_selections_one_active_per_request
  ON public.marketplace_selections (service_request_id)
  WHERE status IN ('pending_unlock', 'unlocked');

COMMENT ON TABLE public.marketplace_selections IS
  'Dalily 2.0 Marketplace selection placeholder. Unused by product UI until Sprint 4/5.';

-- Read-model projection (Marketplace service owned projection of request lifecycle)
CREATE TABLE IF NOT EXISTS public.marketplace_request_projections (
  service_request_id uuid PRIMARY KEY REFERENCES public.service_requests (id) ON DELETE CASCADE,
  lifecycle_phase text NOT NULL,
  legacy_status text NOT NULL,
  selection_id uuid NULL,
  lifecycle_version smallint NOT NULL DEFAULT 1,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_request_projections_phase_idx
  ON public.marketplace_request_projections (lifecycle_phase);

COMMENT ON TABLE public.marketplace_request_projections IS
  'Dalily 2.0 Marketplace projection synced when MARKETPLACE_DOMAIN_V2 is on. Not authoritative for money/PII.';

-- FK from service_requests.selection_id → marketplace_selections (deferrable soft link)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_requests_selection_id_fkey'
  ) THEN
    ALTER TABLE public.service_requests
      ADD CONSTRAINT service_requests_selection_id_fkey
      FOREIGN KEY (selection_id) REFERENCES public.marketplace_selections (id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.marketplace_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_request_projections ENABLE ROW LEVEL SECURITY;

-- Read policies: same principals who can read the underlying service_request
DROP POLICY IF EXISTS marketplace_selections_select ON public.marketplace_selections;
CREATE POLICY marketplace_selections_select ON public.marketplace_selections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = marketplace_selections.service_request_id
        AND (
          sr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = sr.provider_id AND p.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
          )
        )
    )
  );

DROP POLICY IF EXISTS marketplace_projections_select ON public.marketplace_request_projections;
CREATE POLICY marketplace_projections_select ON public.marketplace_request_projections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = marketplace_request_projections.service_request_id
        AND (
          sr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = sr.provider_id AND p.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
          )
        )
    )
  );

-- Upsert projection from app (customer or provider on the request)
DROP POLICY IF EXISTS marketplace_projections_upsert ON public.marketplace_request_projections;
CREATE POLICY marketplace_projections_upsert ON public.marketplace_request_projections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = marketplace_request_projections.service_request_id
        AND (
          sr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = sr.provider_id AND p.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = marketplace_request_projections.service_request_id
        AND (
          sr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = sr.provider_id AND p.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
          )
        )
    )
  );
