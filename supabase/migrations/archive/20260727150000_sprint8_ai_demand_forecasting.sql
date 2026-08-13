-- Sprint 8 Phase 3 — AI Demand Forecasting & Market Prediction
-- Predictions are advisory only — never guarantee future outcomes.

CREATE TABLE IF NOT EXISTS public.forecast_models (
  model_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  algorithm TEXT NOT NULL DEFAULT 'forecast-v1',
  signal_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ml_ready BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forecast_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key TEXT NOT NULL DEFAULT 'forecast-v1',
  algorithm_version TEXT NOT NULL DEFAULT 'forecast-v1',
  experiment_id TEXT,
  category_key TEXT,
  region_key TEXT NOT NULL DEFAULT 'all',
  horizon TEXT NOT NULL
    CHECK (horizon IN ('24h', '7d', '30d', '90d')),
  expected_demand NUMERIC(12,4) NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  trend TEXT NOT NULL DEFAULT 'stable'
    CHECK (trend IN ('rising', 'stable', 'declining')),
  recommended_capacity NUMERIC(10,2),
  signal_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  latency_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forecast_history_created_idx
  ON public.forecast_history (created_at DESC);
CREATE INDEX IF NOT EXISTS forecast_history_lookup_idx
  ON public.forecast_history (category_key, region_key, horizon, created_at DESC);

CREATE TABLE IF NOT EXISTS public.forecast_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES public.forecast_history(id) ON DELETE CASCADE,
  provider_id UUID,
  category_key TEXT,
  region_key TEXT NOT NULL DEFAULT 'all',
  horizon TEXT NOT NULL
    CHECK (horizon IN ('24h', '7d', '30d', '90d')),
  expected_demand NUMERIC(12,4) NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  trend TEXT NOT NULL DEFAULT 'stable',
  recommended_capacity NUMERIC(10,2),
  busy_periods JSONB NOT NULL DEFAULT '[]'::jsonb,
  best_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  revenue_opportunity NUMERIC(14,2),
  vacation_windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  public_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  cached_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forecast_results_provider_idx
  ON public.forecast_results (provider_id, horizon, created_at DESC);
CREATE INDEX IF NOT EXISTS forecast_results_cache_idx
  ON public.forecast_results (category_key, region_key, horizon, cached_until);

CREATE TABLE IF NOT EXISTS public.forecast_accuracy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES public.forecast_history(id) ON DELETE SET NULL,
  model_key TEXT,
  horizon TEXT NOT NULL,
  predicted_demand NUMERIC(12,4) NOT NULL,
  actual_demand NUMERIC(12,4),
  absolute_error NUMERIC(12,4),
  percent_error NUMERIC(10,4),
  evaluated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forecast_accuracy_model_idx
  ON public.forecast_accuracy (model_key, created_at DESC);

CREATE TABLE IF NOT EXISTS public.forecast_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES public.forecast_history(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ar TEXT,
  audience TEXT NOT NULL DEFAULT 'public'
    CHECK (audience IN ('public', 'provider', 'admin')),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forecast_market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL,
  region_key TEXT NOT NULL DEFAULT 'all',
  booking_velocity NUMERIC(12,4) NOT NULL DEFAULT 0,
  demand_index NUMERIC(8,4) NOT NULL DEFAULT 0.5,
  cancellation_rate NUMERIC(8,4),
  complaint_rate NUMERIC(8,4),
  provider_availability_index NUMERIC(8,4),
  pricing_trend_index NUMERIC(8,4),
  growing BOOLEAN NOT NULL DEFAULT false,
  declining BOOLEAN NOT NULL DEFAULT false,
  sample_count INTEGER NOT NULL DEFAULT 0,
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_key, region_key)
);

CREATE INDEX IF NOT EXISTS forecast_market_snapshots_lookup_idx
  ON public.forecast_market_snapshots (category_key, region_key);

CREATE TABLE IF NOT EXISTS public.forecast_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  algorithm_a TEXT NOT NULL DEFAULT 'forecast-v1',
  algorithm_b TEXT NOT NULL DEFAULT 'forecast-ml-v0',
  traffic_b_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (traffic_b_pct >= 0 AND traffic_b_pct <= 100),
  active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forecast_signal_weights (
  signal_key TEXT PRIMARY KEY,
  category TEXT NOT NULL
    CHECK (category IN (
      'history', 'geo', 'time', 'calendar', 'supply', 'quality', 'market', 'ml', 'other'
    )),
  weight NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ml_ready BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.forecast_signal_weights (signal_key, category, weight, enabled, ml_ready, description) VALUES
  ('historical_bookings', 'history', 1.40, true, true, 'Historical booking volume'),
  ('category_demand', 'market', 1.20, true, true, 'Category demand index'),
  ('regional_demand', 'geo', 0.90, true, true, 'Regional demand shifts'),
  ('seasonality', 'time', 0.80, true, true, 'Seasonal patterns'),
  ('weekday_patterns', 'time', 0.70, true, false, 'Weekday demand patterns'),
  ('time_of_day', 'time', 0.55, true, false, 'Hour-of-day patterns'),
  ('holiday_calendar', 'calendar', 0.60, true, false, 'Public holidays'),
  ('weather', 'calendar', 0.25, true, true, 'Weather (future-ready)'),
  ('school_holidays', 'calendar', 0.45, true, false, 'School holiday uplift'),
  ('business_events', 'calendar', 0.35, true, false, 'Local business events'),
  ('provider_availability', 'supply', 0.85, true, false, 'Supply / capacity pressure'),
  ('pricing_trends', 'market', 0.50, true, true, 'Recent pricing trend'),
  ('cancellation_trends', 'quality', 0.55, true, true, 'Cancellation rate impact'),
  ('complaint_trends', 'quality', 0.40, true, true, 'Complaint rate impact'),
  ('economic_indicators', 'market', 0.20, true, true, 'Economic indicators (future-ready)'),
  ('ml_forecast', 'ml', 1.00, true, true, 'Optional ML forecast contribution')
ON CONFLICT (signal_key) DO NOTHING;

INSERT INTO public.forecast_models (model_key, title, description, algorithm, enabled, ml_ready, is_default)
VALUES
  ('forecast-v1', 'Rules forecast v1', 'Weighted rule-based demand forecast', 'forecast-v1', true, false, true),
  ('forecast-ml-v0', 'ML-ready shadow', 'Scaffold for ML forecasting models', 'forecast-ml-v0', true, true, false)
ON CONFLICT (model_key) DO NOTHING;

INSERT INTO public.forecast_experiments (experiment_key, title, description, algorithm_a, algorithm_b, traffic_b_pct, active)
VALUES (
  'forecast_default',
  'Rules vs ML-ready shadow',
  'A/B scaffold for demand forecasting versions',
  'forecast-v1',
  'forecast-ml-v0',
  0,
  false
)
ON CONFLICT (experiment_key) DO NOTHING;

ALTER TABLE public.forecast_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_accuracy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_signal_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forecast_models_admin ON public.forecast_models;
CREATE POLICY forecast_models_admin ON public.forecast_models
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS forecast_weights_admin ON public.forecast_signal_weights;
CREATE POLICY forecast_weights_admin ON public.forecast_signal_weights
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS forecast_history_admin ON public.forecast_history;
CREATE POLICY forecast_history_admin ON public.forecast_history
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS forecast_results_select ON public.forecast_results;
CREATE POLICY forecast_results_select ON public.forecast_results
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
    OR provider_id IS NULL
  );

DROP POLICY IF EXISTS forecast_accuracy_admin ON public.forecast_accuracy;
CREATE POLICY forecast_accuracy_admin ON public.forecast_accuracy
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS forecast_explanations_select ON public.forecast_explanations;
CREATE POLICY forecast_explanations_select ON public.forecast_explanations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS forecast_snapshots_select ON public.forecast_market_snapshots;
CREATE POLICY forecast_snapshots_select ON public.forecast_market_snapshots
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS forecast_snapshots_admin ON public.forecast_market_snapshots;
CREATE POLICY forecast_snapshots_admin ON public.forecast_market_snapshots
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS forecast_experiments_admin ON public.forecast_experiments;
CREATE POLICY forecast_experiments_admin ON public.forecast_experiments
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

COMMENT ON TABLE public.forecast_history IS
  'Sprint 8 Phase 3 — demand forecasts (advisory only; never guarantees).';
COMMENT ON TABLE public.forecast_explanations IS
  'Public-safe forecast explanations — no internal formula exposure.';
