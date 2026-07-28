-- Sprint 4 — Offer System (additive)
-- Competing marketplace offers from match_assignments; selection without PII/chat release.
-- Does NOT alter quotes table. Legacy RFQ quotes remain for lifecycle_version = 1.

CREATE TABLE IF NOT EXISTS public.marketplace_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  match_assignment_id uuid NOT NULL REFERENCES public.match_assignments (id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  price numeric(12, 2) NOT NULL CHECK (price > 0),
  currency text NOT NULL DEFAULT 'SYP',
  price_model text NOT NULL DEFAULT 'fixed'
    CHECK (price_model IN ('fixed', 'hourly', 'estimate')),
  inclusions text NULL,
  eta_text text NULL,
  message text NULL,
  expires_at timestamptz NULL,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'withdrawn', 'selected', 'superseded', 'expired')),
  quality_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_offers_unique_assignment UNIQUE (match_assignment_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS marketplace_offers_one_sent_per_provider
  ON public.marketplace_offers (service_request_id, provider_id)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS marketplace_offers_request_idx
  ON public.marketplace_offers (service_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_offers_provider_idx
  ON public.marketplace_offers (provider_id, created_at DESC);

COMMENT ON TABLE public.marketplace_offers IS
  'Dalily 2.0 Offer Service — competing offers rooted in match_assignments (Sprint 4).';

CREATE TABLE IF NOT EXISTS public.offer_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  label text NOT NULL,
  price numeric(12, 2) NULL,
  currency text NOT NULL DEFAULT 'SYP',
  price_model text NOT NULL DEFAULT 'fixed'
    CHECK (price_model IN ('fixed', 'hourly', 'estimate')),
  inclusions text NULL,
  eta_text text NULL,
  message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_templates_provider_idx
  ON public.offer_templates (provider_id, updated_at DESC);

COMMENT ON TABLE public.offer_templates IS
  'Provider offer drafts for <60s create (Sprint 4). Not ranking/visibility boosts.';

-- Soft FK from marketplace_offers.template_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_offers_template_id_fkey'
  ) THEN
    ALTER TABLE public.marketplace_offers
      ADD CONSTRAINT marketplace_offers_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES public.offer_templates (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Soft FK from marketplace_selections.offer_id → marketplace_offers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_selections_offer_id_fkey'
  ) THEN
    ALTER TABLE public.marketplace_selections
      ADD CONSTRAINT marketplace_selections_offer_id_fkey
      FOREIGN KEY (offer_id) REFERENCES public.marketplace_offers (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Structured Q&A pre-unlock (not full chat; no PII channel)
CREATE TABLE IF NOT EXISTS public.offer_clarifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.marketplace_offers (id) ON DELETE CASCADE,
  service_request_id uuid NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  author_role text NOT NULL CHECK (author_role IN ('customer', 'provider')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offer_clarifications_offer_idx
  ON public.offer_clarifications (offer_id, created_at ASC);

COMMENT ON TABLE public.offer_clarifications IS
  'Limited pre-unlock Q&A on an offer. Not messaging/chat (Sprint 7).';

ALTER TABLE public.marketplace_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_clarifications ENABLE ROW LEVEL SECURITY;

-- Offers: customer of request, offering provider owner, or admin
DROP POLICY IF EXISTS marketplace_offers_select ON public.marketplace_offers;
CREATE POLICY marketplace_offers_select ON public.marketplace_offers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = marketplace_offers.service_request_id
        AND sr.customer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = marketplace_offers.provider_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS marketplace_offers_provider_insert ON public.marketplace_offers;
CREATE POLICY marketplace_offers_provider_insert ON public.marketplace_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      JOIN public.match_assignments ma ON ma.provider_id = p.id
      WHERE p.id = marketplace_offers.provider_id
        AND p.owner_id = auth.uid()
        AND ma.id = marketplace_offers.match_assignment_id
        AND ma.service_request_id = marketplace_offers.service_request_id
        AND ma.provider_id = marketplace_offers.provider_id
    )
  );

DROP POLICY IF EXISTS marketplace_offers_provider_update ON public.marketplace_offers;
CREATE POLICY marketplace_offers_provider_update ON public.marketplace_offers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = marketplace_offers.provider_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = marketplace_offers.provider_id AND p.owner_id = auth.uid()
    )
  );

-- Templates: owner only
DROP POLICY IF EXISTS offer_templates_owner_all ON public.offer_templates;
CREATE POLICY offer_templates_owner_all ON public.offer_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = offer_templates.provider_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = offer_templates.provider_id AND p.owner_id = auth.uid()
    )
  );

-- Clarifications: customer of request or offering provider
DROP POLICY IF EXISTS offer_clarifications_select ON public.offer_clarifications;
CREATE POLICY offer_clarifications_select ON public.offer_clarifications
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.marketplace_offers o
      JOIN public.service_requests sr ON sr.id = o.service_request_id
      LEFT JOIN public.providers p ON p.id = o.provider_id
      WHERE o.id = offer_clarifications.offer_id
        AND (sr.customer_id = auth.uid() OR p.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS offer_clarifications_insert ON public.offer_clarifications;
CREATE POLICY offer_clarifications_insert ON public.offer_clarifications
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.marketplace_offers o
      JOIN public.service_requests sr ON sr.id = o.service_request_id
      LEFT JOIN public.providers p ON p.id = o.provider_id
      WHERE o.id = offer_clarifications.offer_id
        AND o.service_request_id = offer_clarifications.service_request_id
        AND (
          (offer_clarifications.author_role = 'customer' AND sr.customer_id = auth.uid())
          OR (offer_clarifications.author_role = 'provider' AND p.owner_id = auth.uid())
        )
    )
  );

-- Allow selection SELECT for offer's provider (not only sr.provider_id)
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
            SELECT 1 FROM public.providers p
            WHERE p.id = marketplace_selections.provider_id AND p.owner_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
          )
        )
    )
  );
