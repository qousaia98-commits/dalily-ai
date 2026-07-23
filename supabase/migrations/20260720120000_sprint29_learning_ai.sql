-- Sprint 29: Dalily Learning AI
-- Append-only learning events + cached performance/preference profiles.
-- Never mutates historical service_requests rows.

-- =============================================================================
-- LEARNING EVENTS (append-only marketplace training signal)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(64) NOT NULL,
  provider_id UUID REFERENCES public.providers (id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  service_request_id UUID REFERENCES public.service_requests (id) ON DELETE SET NULL,
  search_log_id UUID REFERENCES public.search_logs (id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT learning_events_type_chk CHECK (
    event_type IN (
      'provider_viewed',
      'provider_clicked',
      'request_started',
      'request_sent',
      'request_accepted',
      'request_declined',
      'provider_no_response',
      'request_completed',
      'customer_cancelled',
      'provider_cancelled',
      'review_submitted',
      'repeat_booking',
      'recommendation_shown',
      'recommendation_chosen'
    )
  )
);

COMMENT ON TABLE public.learning_events IS
  'Append-only anonymous learning signals for Dalily AI. Never rewrite; never store exact GPS.';

CREATE INDEX IF NOT EXISTS learning_events_type_created_idx
  ON public.learning_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS learning_events_provider_created_idx
  ON public.learning_events (provider_id, created_at DESC)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS learning_events_customer_created_idx
  ON public.learning_events (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS learning_events_request_idx
  ON public.learning_events (service_request_id)
  WHERE service_request_id IS NOT NULL;

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

-- Inserts via service role / admin client in app. Authenticated may insert own customer_id.
DROP POLICY IF EXISTS "learning_events_insert_authenticated" ON public.learning_events;
CREATE POLICY "learning_events_insert_authenticated" ON public.learning_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    customer_id IS NULL OR customer_id = auth.uid()
  );

DROP POLICY IF EXISTS "learning_events_select_admin" ON public.learning_events;
CREATE POLICY "learning_events_select_admin" ON public.learning_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );

-- No UPDATE / DELETE policies → append-only for normal roles.

-- =============================================================================
-- PROVIDER PERFORMANCE SCORES (derived cache — not historical request mutation)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.provider_performance_scores (
  provider_id UUID PRIMARY KEY REFERENCES public.providers (id) ON DELETE CASCADE,
  performance_score NUMERIC(6, 4) NOT NULL DEFAULT 0.5000
    CHECK (performance_score >= 0 AND performance_score <= 1),
  acceptance_rate NUMERIC(6, 4),
  completion_rate NUMERIC(6, 4),
  avg_rating NUMERIC(4, 2),
  avg_response_hours NUMERIC(10, 2),
  cancellation_rate NUMERIC(6, 4),
  repeat_customer_rate NUMERIC(6, 4),
  successful_jobs INTEGER NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  data_quality NUMERIC(6, 4) NOT NULL DEFAULT 0
    CHECK (data_quality >= 0 AND data_quality <= 1),
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.provider_performance_scores IS
  'Cached AI Performance Score per provider. Internal only — never expose raw score publicly.';

CREATE INDEX IF NOT EXISTS provider_performance_score_idx
  ON public.provider_performance_scores (performance_score DESC);

CREATE INDEX IF NOT EXISTS provider_performance_quality_idx
  ON public.provider_performance_scores (data_quality DESC, sample_size DESC);

ALTER TABLE public.provider_performance_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provider_performance_select_admin" ON public.provider_performance_scores;
CREATE POLICY "provider_performance_select_admin" ON public.provider_performance_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );

-- Owner may see anonymized aggregate for their own business (not for public SERP).
DROP POLICY IF EXISTS "provider_performance_select_owner" ON public.provider_performance_scores;
CREATE POLICY "provider_performance_select_owner" ON public.provider_performance_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

-- Writes via service role only (no INSERT/UPDATE policies for authenticated).

-- =============================================================================
-- CUSTOMER PREFERENCE PROFILES (personalization — small signal)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customer_preference_profiles (
  customer_id UUID PRIMARY KEY REFERENCES public.users (id) ON DELETE CASCADE,
  prefer_nearby NUMERIC(6, 4) NOT NULL DEFAULT 0.5000,
  prefer_premium NUMERIC(6, 4) NOT NULL DEFAULT 0.5000,
  prefer_high_rating NUMERIC(6, 4) NOT NULL DEFAULT 0.5000,
  prefer_fast_response NUMERIC(6, 4) NOT NULL DEFAULT 0.5000,
  sample_size INTEGER NOT NULL DEFAULT 0,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_preference_profiles IS
  'Learned customer preference weights (0–1). Used only as a small personalization signal.';

ALTER TABLE public.customer_preference_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_prefs_select_own_or_admin" ON public.customer_preference_profiles;
CREATE POLICY "customer_prefs_select_own_or_admin" ON public.customer_preference_profiles
  FOR SELECT
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );
