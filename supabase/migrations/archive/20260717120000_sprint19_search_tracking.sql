-- Sprint 19: Search ranking snapshots + engagement events (real analytics only)

ALTER TABLE public.search_logs
  ADD COLUMN IF NOT EXISTS nearby_radius VARCHAR(16),
  ADD COLUMN IF NOT EXISTS ranking_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.search_logs.ranking_snapshot IS
  'Ordered candidates with factor scores for growth-potential re-ranking. Never stores customer GPS.';

CREATE INDEX IF NOT EXISTS search_logs_category_created_idx
  ON public.search_logs (category_slug, created_at DESC)
  WHERE category_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS search_logs_city_created_idx
  ON public.search_logs (city_slug, created_at DESC)
  WHERE city_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS search_logs_provider_ids_gin
  ON public.search_logs USING GIN (provider_ids);

-- Engagement funnel (profile views, contacts, favorites, SERP clicks)
CREATE TABLE IF NOT EXISTS public.provider_engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  event_type VARCHAR(40) NOT NULL,
  search_log_id UUID REFERENCES public.search_logs (id) ON DELETE SET NULL,
  position SMALLINT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provider_engagement_events_type_chk CHECK (
    event_type IN (
      'impression',
      'serp_click',
      'profile_view',
      'contact_phone',
      'contact_whatsapp',
      'favorite'
    )
  )
);

CREATE INDEX provider_engagement_provider_created_idx
  ON public.provider_engagement_events (provider_id, created_at DESC);

CREATE INDEX provider_engagement_type_created_idx
  ON public.provider_engagement_events (event_type, created_at DESC);

ALTER TABLE public.provider_engagement_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_engagement_insert_all" ON public.provider_engagement_events
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "provider_engagement_select_owner_or_admin" ON public.provider_engagement_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );
