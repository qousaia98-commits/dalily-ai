-- Sprint 8 Phase 1 — AI Smart Matching Engine
-- Modular weighted signals, fairness, preferences, capacity, experiments.

CREATE TABLE IF NOT EXISTS public.matching_weights (
  signal_key TEXT PRIMARY KEY,
  category TEXT NOT NULL
    CHECK (category IN (
      'geo', 'availability', 'reputation', 'quality', 'behaviour',
      'identity', 'preference', 'price', 'fairness', 'risk', 'ml', 'other'
    )),
  weight NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ml_ready BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matching_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT,
  customer_id UUID,
  provider_id UUID NOT NULL,
  internal_score NUMERIC(8,4) NOT NULL,
  signal_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  fairness_boost NUMERIC(8,4) NOT NULL DEFAULT 0,
  ml_contribution NUMERIC(8,4) NOT NULL DEFAULT 0,
  algorithm_version TEXT NOT NULL DEFAULT 'smart-match-v1',
  experiment_id TEXT,
  latency_ms INTEGER,
  rank INTEGER,
  cached_until TIMESTAMPTZ,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matching_scores_provider_idx
  ON public.matching_scores (provider_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS matching_scores_request_idx
  ON public.matching_scores (request_id, rank)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS matching_scores_cache_idx
  ON public.matching_scores (provider_id, cached_until)
  WHERE cached_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.matching_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT,
  customer_id UUID,
  provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  algorithm_version TEXT NOT NULL,
  experiment_id TEXT,
  latency_ms INTEGER,
  source TEXT NOT NULL DEFAULT 'marketplace'
    CHECK (source IN ('marketplace', 'search', 'simulation', 'replay')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matching_history_created_idx
  ON public.matching_history (created_at DESC);

CREATE TABLE IF NOT EXISTS public.matching_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT,
  booking_id UUID,
  customer_id UUID,
  provider_id UUID NOT NULL,
  recommended BOOLEAN NOT NULL DEFAULT false,
  accepted BOOLEAN,
  completed BOOLEAN,
  rating NUMERIC(3,1),
  complaint BOOLEAN NOT NULL DEFAULT false,
  repeat_booking BOOLEAN NOT NULL DEFAULT false,
  algorithm_version TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matching_feedback_provider_idx
  ON public.matching_feedback (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.matching_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id UUID REFERENCES public.matching_scores(id) ON DELETE CASCADE,
  request_id TEXT,
  provider_id UUID NOT NULL,
  code TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ar TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matching_explanations_provider_idx
  ON public.matching_explanations (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_preferences (
  customer_id UUID PRIMARY KEY,
  preferred_language TEXT,
  preferred_gender TEXT,
  budget_min NUMERIC(12,2),
  budget_max NUMERIC(12,2),
  preferred_response_speed TEXT
    CHECK (preferred_response_speed IS NULL OR preferred_response_speed IN ('fast', 'normal', 'flexible')),
  favourite_provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  preferred_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  favourite_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  frequent_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  learned_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_capacity (
  provider_id UUID PRIMARY KEY,
  max_daily_jobs INTEGER NOT NULL DEFAULT 8,
  jobs_today INTEGER NOT NULL DEFAULT 0,
  vacation_mode BOOLEAN NOT NULL DEFAULT false,
  pause_mode BOOLEAN NOT NULL DEFAULT false,
  accepting_requests BOOLEAN NOT NULL DEFAULT true,
  business_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_available_at TIMESTAMPTZ,
  workload_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matching_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  algorithm_a TEXT NOT NULL DEFAULT 'smart-match-v1',
  algorithm_b TEXT NOT NULL DEFAULT 'smart-match-ml-v0',
  traffic_b_pct NUMERIC(5,2) NOT NULL DEFAULT 10
    CHECK (traffic_b_pct >= 0 AND traffic_b_pct <= 100),
  active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.matching_fairness_state (
  provider_id UUID PRIMARY KEY,
  exploration_boost NUMERIC(8,4) NOT NULL DEFAULT 0,
  cold_start_boost NUMERIC(8,4) NOT NULL DEFAULT 0,
  rotation_token NUMERIC(8,4) NOT NULL DEFAULT 0,
  boost_expires_at TIMESTAMPTZ,
  impressions INTEGER NOT NULL DEFAULT 0,
  selections INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default weights (idempotent)
INSERT INTO public.matching_weights (signal_key, category, weight, enabled, ml_ready, description) VALUES
  ('distance', 'geo', 1.50, true, false, 'Proximity / travel distance'),
  ('travel_time', 'geo', 0.80, true, true, 'Estimated travel time'),
  ('availability', 'availability', 1.20, true, false, 'Accepting requests / live availability'),
  ('workload', 'availability', 0.90, true, true, 'Current workload / capacity'),
  ('reputation', 'reputation', 1.10, true, true, 'AI reputation soft boost'),
  ('trust_level', 'reputation', 0.70, true, false, 'Public trust level'),
  ('verification', 'identity', 1.00, true, false, 'Verification level'),
  ('category_expertise', 'quality', 1.20, true, false, 'Category fit / expertise'),
  ('experience', 'quality', 0.70, true, false, 'Years / completed volume proxy'),
  ('completed_jobs', 'behaviour', 0.80, true, false, 'Completed jobs volume'),
  ('repeat_customers', 'behaviour', 0.60, true, true, 'Repeat customer rate'),
  ('response_time', 'behaviour', 0.90, true, false, 'Average response time'),
  ('acceptance_rate', 'behaviour', 0.90, true, false, 'Offer acceptance rate'),
  ('completion_rate', 'behaviour', 0.90, true, false, 'Job completion rate'),
  ('cancellation_rate', 'behaviour', -0.70, true, false, 'Cancellation rate (negative)'),
  ('recommendation_rate', 'behaviour', 0.50, true, true, 'Recommendation / rehire rate'),
  ('review_quality', 'quality', 1.00, true, true, 'Review quality / rating'),
  ('recent_activity', 'availability', 0.40, true, false, 'Recent platform activity'),
  ('business_hours', 'availability', 0.50, true, false, 'Within business hours'),
  ('languages', 'preference', 0.40, true, false, 'Language overlap'),
  ('price_competitiveness', 'price', 0.60, true, true, 'Price vs market'),
  ('quality_cases', 'risk', -0.80, true, false, 'Open quality cases (negative)'),
  ('fraud_risk', 'risk', -1.20, true, true, 'Internal fraud risk (negative, admin-sourced)'),
  ('customer_preferences', 'preference', 0.70, true, true, 'Learned customer preferences'),
  ('preferred_history', 'preference', 0.80, true, false, 'Previously booked providers'),
  ('favourite_providers', 'preference', 1.00, true, false, 'Explicit favourites'),
  ('fairness_exploration', 'fairness', 0.35, true, false, 'Exploration / cold-start fairness'),
  ('ml_ranker', 'ml', 1.00, true, true, 'Optional ML ranker contribution')
ON CONFLICT (signal_key) DO NOTHING;

INSERT INTO public.matching_experiments (experiment_key, title, description, algorithm_a, algorithm_b, traffic_b_pct, active)
VALUES (
  'smart_match_default',
  'Rules vs ML-ready shadow',
  'A/B scaffold: rule engine vs future ML layer',
  'smart-match-v1',
  'smart-match-ml-v0',
  0,
  false
)
ON CONFLICT (experiment_key) DO NOTHING;

-- RLS: scores/history admin+service; prefs own user; capacity provider owner
ALTER TABLE public.matching_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_fairness_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS matching_weights_admin ON public.matching_weights;
CREATE POLICY matching_weights_admin ON public.matching_weights
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS matching_scores_admin ON public.matching_scores;
CREATE POLICY matching_scores_admin ON public.matching_scores
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS matching_history_admin ON public.matching_history;
CREATE POLICY matching_history_admin ON public.matching_history
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS matching_feedback_admin ON public.matching_feedback;
CREATE POLICY matching_feedback_admin ON public.matching_feedback
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS matching_explanations_select ON public.matching_explanations;
CREATE POLICY matching_explanations_select ON public.matching_explanations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS customer_prefs_own ON public.customer_preferences;
CREATE POLICY customer_prefs_own ON public.customer_preferences
  FOR ALL TO authenticated
  USING (customer_id = auth.uid() OR public.has_role('admin'))
  WITH CHECK (customer_id = auth.uid() OR public.has_role('admin'));

DROP POLICY IF EXISTS provider_capacity_owner ON public.provider_capacity;
CREATE POLICY provider_capacity_owner ON public.provider_capacity
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS provider_capacity_owner_write ON public.provider_capacity;
CREATE POLICY provider_capacity_owner_write ON public.provider_capacity
  FOR ALL TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS matching_experiments_admin ON public.matching_experiments;
CREATE POLICY matching_experiments_admin ON public.matching_experiments
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS matching_fairness_admin ON public.matching_fairness_state;
CREATE POLICY matching_fairness_admin ON public.matching_fairness_state
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

COMMENT ON TABLE public.matching_scores IS
  'Sprint 8 Phase 1 — internal match scores (never public).';
COMMENT ON TABLE public.matching_explanations IS
  'Public-safe explanation bullets only — no numeric scores.';
