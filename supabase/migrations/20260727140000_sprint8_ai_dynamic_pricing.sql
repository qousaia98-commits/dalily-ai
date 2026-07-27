-- Sprint 8 Phase 2 — AI Dynamic Pricing & Market Intelligence
-- Recommendations only — Dalily never forces provider prices.

CREATE TABLE IF NOT EXISTS public.pricing_weights (
  signal_key TEXT PRIMARY KEY,
  category TEXT NOT NULL
    CHECK (category IN (
      'market', 'geo', 'job', 'time', 'provider', 'customer', 'risk', 'ml', 'other'
    )),
  weight NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ml_ready BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_market_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL,
  region_key TEXT NOT NULL DEFAULT 'all',
  currency TEXT NOT NULL DEFAULT 'SYP',
  sample_count INTEGER NOT NULL DEFAULT 0,
  avg_price NUMERIC(14,2),
  p25_price NUMERIC(14,2),
  p50_price NUMERIC(14,2),
  p75_price NUMERIC(14,2),
  min_price NUMERIC(14,2),
  max_price NUMERIC(14,2),
  demand_index NUMERIC(8,4) NOT NULL DEFAULT 0.5,
  acceptance_rate NUMERIC(8,4),
  completion_rate NUMERIC(8,4),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_key, region_key, currency)
);

CREATE INDEX IF NOT EXISTS pricing_market_data_lookup_idx
  ON public.pricing_market_data (category_key, region_key);

CREATE TABLE IF NOT EXISTS public.pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT,
  offer_id UUID,
  provider_id UUID,
  customer_id UUID,
  category_key TEXT,
  region_key TEXT,
  currency TEXT NOT NULL DEFAULT 'SYP',
  suggested_min NUMERIC(14,2) NOT NULL,
  suggested_avg NUMERIC(14,2) NOT NULL,
  suggested_premium NUMERIC(14,2) NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  market_position TEXT,
  signal_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL DEFAULT 'pricing-v1',
  experiment_id TEXT,
  latency_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pricing_history_created_idx
  ON public.pricing_history (created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_history_provider_idx
  ON public.pricing_history (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pricing_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES public.pricing_history(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ar TEXT,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES public.pricing_history(id) ON DELETE SET NULL,
  provider_id UUID,
  customer_id UUID,
  offered_price NUMERIC(14,2),
  accepted BOOLEAN,
  completed BOOLEAN,
  within_suggested_range BOOLEAN,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pricing_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  algorithm_a TEXT NOT NULL DEFAULT 'pricing-v1',
  algorithm_b TEXT NOT NULL DEFAULT 'pricing-ml-v0',
  traffic_b_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (traffic_b_pct >= 0 AND traffic_b_pct <= 100),
  active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.pricing_weights (signal_key, category, weight, enabled, ml_ready, description) VALUES
  ('service_category', 'market', 1.40, true, false, 'Category base market level'),
  ('region', 'geo', 0.80, true, false, 'Regional cost of service'),
  ('travel_distance', 'geo', 0.70, true, false, 'Travel distance surcharge'),
  ('travel_time', 'geo', 0.50, true, true, 'Travel time surcharge'),
  ('job_complexity', 'job', 1.20, true, false, 'Complexity multiplier'),
  ('estimated_duration', 'job', 1.00, true, false, 'Duration / labour time'),
  ('urgency', 'time', 1.10, true, false, 'Urgency / emergency premium'),
  ('season', 'time', 0.40, true, true, 'Seasonal demand'),
  ('day_of_week', 'time', 0.35, true, false, 'Weekend / weekday'),
  ('time_of_day', 'time', 0.30, true, false, 'Peak hours'),
  ('historical_prices', 'market', 1.30, true, true, 'Historical accepted prices'),
  ('market_demand', 'market', 0.90, true, true, 'Current demand index'),
  ('provider_reputation', 'provider', 0.60, true, true, 'Reputation / trust soft premium'),
  ('provider_experience', 'provider', 0.50, true, false, 'Experience premium'),
  ('material_requirements', 'job', 0.70, true, false, 'Materials / parts'),
  ('weather', 'risk', 0.20, true, true, 'Weather (future-ready)'),
  ('holiday_calendar', 'time', 0.45, true, false, 'Holiday surcharge'),
  ('repeat_customer', 'customer', -0.25, true, false, 'Repeat customer discount hint'),
  ('business_customer', 'customer', 0.35, true, false, 'Business / B2B uplift'),
  ('large_project', 'job', 0.90, true, false, 'Large / multi-day project'),
  ('ml_pricing', 'ml', 1.00, true, true, 'Optional ML pricing contribution')
ON CONFLICT (signal_key) DO NOTHING;

INSERT INTO public.pricing_experiments (experiment_key, title, description, algorithm_a, algorithm_b, traffic_b_pct, active)
VALUES (
  'pricing_default',
  'Rules vs ML-ready shadow',
  'A/B scaffold for pricing engine versions',
  'pricing-v1',
  'pricing-ml-v0',
  0,
  false
)
ON CONFLICT (experiment_key) DO NOTHING;

ALTER TABLE public.pricing_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pricing_weights_admin ON public.pricing_weights;
CREATE POLICY pricing_weights_admin ON public.pricing_weights
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS pricing_market_select ON public.pricing_market_data;
CREATE POLICY pricing_market_select ON public.pricing_market_data
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS pricing_market_admin ON public.pricing_market_data;
CREATE POLICY pricing_market_admin ON public.pricing_market_data
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS pricing_history_admin ON public.pricing_history;
CREATE POLICY pricing_history_admin ON public.pricing_history
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS pricing_explanations_select ON public.pricing_explanations;
CREATE POLICY pricing_explanations_select ON public.pricing_explanations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS pricing_feedback_rw ON public.pricing_feedback;
CREATE POLICY pricing_feedback_rw ON public.pricing_feedback
  FOR ALL TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
    OR customer_id = auth.uid()
  )
  WITH CHECK (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
    OR customer_id = auth.uid()
  );

DROP POLICY IF EXISTS pricing_experiments_admin ON public.pricing_experiments;
CREATE POLICY pricing_experiments_admin ON public.pricing_experiments
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

COMMENT ON TABLE public.pricing_history IS
  'Sprint 8 Phase 2 — price recommendations (never forced). Internal breakdown admin-only via history.';
COMMENT ON TABLE public.pricing_explanations IS
  'Public-safe pricing explanations — no internal formula exposure.';
