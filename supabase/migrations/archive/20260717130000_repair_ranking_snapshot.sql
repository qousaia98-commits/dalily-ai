-- Sprint 19.1 repair: ensure search_logs snapshot columns exist (idempotent).
-- Cause of runtime error: Sprint 19 migration not yet applied on some environments.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'search_logs'
      AND column_name = 'nearby_radius'
  ) THEN
    ALTER TABLE public.search_logs ADD COLUMN nearby_radius VARCHAR(16);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'search_logs'
      AND column_name = 'ranking_snapshot'
  ) THEN
    ALTER TABLE public.search_logs
      ADD COLUMN ranking_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

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

-- Engagement table (idempotent)
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

CREATE INDEX IF NOT EXISTS provider_engagement_provider_created_idx
  ON public.provider_engagement_events (provider_id, created_at DESC);

CREATE INDEX IF NOT EXISTS provider_engagement_type_created_idx
  ON public.provider_engagement_events (event_type, created_at DESC);

ALTER TABLE public.provider_engagement_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_engagement_events'
      AND policyname = 'provider_engagement_insert_all'
  ) THEN
    CREATE POLICY "provider_engagement_insert_all" ON public.provider_engagement_events
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'provider_engagement_events'
      AND policyname = 'provider_engagement_select_owner_or_admin'
  ) THEN
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
  END IF;
END $$;
