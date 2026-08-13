-- Sprint 8 Phase 4 — AI Scheduling, Capacity Optimization & Opportunity Planner
-- Recommendations are advisory only — final decisions stay with the provider.

CREATE TABLE IF NOT EXISTS public.schedule_profiles (
  profile_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  optimization_goal TEXT NOT NULL DEFAULT 'balanced'
    CHECK (optimization_goal IN (
      'balanced', 'min_travel', 'max_utilization', 'max_revenue', 'low_fatigue'
    )),
  signal_weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ml_ready BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_signal_weights (
  signal_key TEXT PRIMARY KEY,
  category TEXT NOT NULL
    CHECK (category IN (
      'bookings', 'travel', 'time', 'capacity', 'job', 'customer', 'quality', 'risk', 'ml', 'other'
    )),
  weight NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ml_ready BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID,
  profile_key TEXT NOT NULL DEFAULT 'balanced-v1',
  algorithm_version TEXT NOT NULL DEFAULT 'schedule-v1',
  experiment_id TEXT,
  schedule_date DATE,
  utilization NUMERIC(8,4),
  travel_minutes NUMERIC(10,2),
  idle_minutes NUMERIC(10,2),
  revenue_forecast NUMERIC(14,2),
  burnout_risk NUMERIC(8,4),
  opportunity_score NUMERIC(8,4),
  signal_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  optimized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  latency_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS schedule_history_provider_idx
  ON public.schedule_history (provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS schedule_history_date_idx
  ON public.schedule_history (schedule_date DESC);

CREATE TABLE IF NOT EXISTS public.schedule_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES public.schedule_history(id) ON DELETE CASCADE,
  provider_id UUID,
  kind TEXT NOT NULL
    CHECK (kind IN (
      'day_optimize', 'gap_fill', 'route', 'opportunity', 'capacity', 'other'
    )),
  title_en TEXT NOT NULL,
  title_ar TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC(8,4),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS schedule_recommendations_provider_idx
  ON public.schedule_recommendations (provider_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.capacity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  day DATE NOT NULL,
  max_daily_jobs INTEGER,
  max_weekly_jobs INTEGER,
  jobs_booked INTEGER NOT NULL DEFAULT 0,
  remaining_capacity INTEGER,
  available_capacity INTEGER,
  overbooking_risk NUMERIC(8,4),
  burnout_risk NUMERIC(8,4),
  vacation_mode BOOLEAN NOT NULL DEFAULT false,
  pause_mode BOOLEAN NOT NULL DEFAULT false,
  workload_score NUMERIC(8,4),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capacity_history_provider_idx
  ON public.capacity_history (provider_id, day DESC);

CREATE TABLE IF NOT EXISTS public.capacity_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID,
  horizon TEXT NOT NULL DEFAULT '7d',
  predicted_jobs NUMERIC(10,2),
  predicted_utilization NUMERIC(8,4),
  burnout_risk NUMERIC(8,4),
  algorithm_version TEXT NOT NULL DEFAULT 'schedule-v1',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  history_id UUID REFERENCES public.schedule_history(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_ar TEXT,
  audience TEXT NOT NULL DEFAULT 'public'
    CHECK (audience IN ('public', 'provider', 'admin')),
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  route_date DATE NOT NULL,
  stops JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_distance_km NUMERIC(10,2),
  total_travel_min NUMERIC(10,2),
  algorithm_version TEXT NOT NULL DEFAULT 'schedule-v1',
  cached_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_routes_lookup_idx
  ON public.provider_routes (provider_id, route_date DESC);

CREATE TABLE IF NOT EXISTS public.provider_schedule_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  gap_date DATE NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'filled', 'ignored', 'expired')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_schedule_gaps_provider_idx
  ON public.provider_schedule_gaps (provider_id, gap_date, status);

CREATE TABLE IF NOT EXISTS public.provider_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  gap_id UUID REFERENCES public.provider_schedule_gaps(id) ON DELETE SET NULL,
  request_id TEXT,
  assignment_id UUID,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  distance_km NUMERIC(10,2),
  travel_minutes NUMERIC(10,2),
  expected_earnings NUMERIC(14,2),
  expected_duration_min INTEGER,
  matching_score NUMERIC(8,4),
  opportunity_score NUMERIC(8,4),
  currency TEXT NOT NULL DEFAULT 'SYP',
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'accepted', 'ignored', 'expired')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS provider_opportunities_provider_idx
  ON public.provider_opportunities (provider_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.provider_opportunity_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID REFERENCES public.provider_opportunities(id) ON DELETE SET NULL,
  provider_id UUID NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('shown', 'accepted', 'ignored', 'expired')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.route_optimization_cache (
  cache_key TEXT PRIMARY KEY,
  provider_id UUID,
  route_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_distance_km NUMERIC(10,2),
  total_travel_min NUMERIC(10,2),
  algorithm_version TEXT NOT NULL DEFAULT 'schedule-v1',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schedule_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  algorithm_a TEXT NOT NULL DEFAULT 'schedule-v1',
  algorithm_b TEXT NOT NULL DEFAULT 'schedule-ml-v0',
  traffic_b_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (traffic_b_pct >= 0 AND traffic_b_pct <= 100),
  active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.schedule_signal_weights (signal_key, category, weight, enabled, ml_ready, description) VALUES
  ('current_bookings', 'bookings', 1.30, true, false, 'Existing day bookings'),
  ('travel_distance', 'travel', 1.20, true, true, 'Travel distance between stops'),
  ('travel_time', 'travel', 1.10, true, true, 'Estimated travel time'),
  ('traffic', 'travel', 0.30, true, true, 'Traffic (future-ready)'),
  ('working_hours', 'time', 1.00, true, false, 'Provider working hours'),
  ('availability', 'capacity', 1.10, true, false, 'Open availability windows'),
  ('provider_capacity', 'capacity', 1.20, true, true, 'Daily/weekly capacity limits'),
  ('breaks', 'time', 0.70, true, false, 'Break / lunch windows'),
  ('job_duration', 'job', 1.00, true, false, 'Estimated job duration'),
  ('preparation_time', 'job', 0.55, true, false, 'Prep before job'),
  ('cleanup_time', 'job', 0.45, true, false, 'Cleanup after job'),
  ('customer_preferred_time', 'customer', 0.90, true, false, 'Customer preferred slots'),
  ('urgency', 'customer', 1.15, true, false, 'Urgency / emergency'),
  ('priority', 'job', 0.80, true, false, 'Job priority'),
  ('category', 'job', 0.50, true, false, 'Service category fit'),
  ('required_skills', 'job', 0.85, true, true, 'Skill match'),
  ('weather', 'risk', 0.25, true, true, 'Weather (future-ready)'),
  ('business_hours', 'time', 0.75, true, false, 'Business hours constraints'),
  ('expected_overtime', 'risk', 0.65, true, true, 'Overtime risk'),
  ('current_fatigue', 'risk', 0.90, true, true, 'Fatigue / burnout score'),
  ('ml_scheduler', 'ml', 1.00, true, true, 'Optional ML scheduler contribution')
ON CONFLICT (signal_key) DO NOTHING;

INSERT INTO public.schedule_profiles (profile_key, title, description, optimization_goal, enabled, ml_ready, is_default)
VALUES
  ('balanced-v1', 'Balanced', 'Balance travel, utilization and fatigue', 'balanced', true, false, true),
  ('min-travel-v1', 'Minimize travel', 'Prefer clustered routes and less travel', 'min_travel', true, false, false),
  ('max-util-v1', 'Max utilization', 'Fill idle gaps when safe', 'max_utilization', true, false, false),
  ('schedule-ml-v0', 'ML-ready shadow', 'Scaffold for ML scheduling', 'balanced', true, true, false)
ON CONFLICT (profile_key) DO NOTHING;

INSERT INTO public.schedule_experiments (experiment_key, title, description, algorithm_a, algorithm_b, traffic_b_pct, active)
VALUES (
  'schedule_default',
  'Rules vs ML-ready shadow',
  'A/B scaffold for scheduling engine versions',
  'schedule-v1',
  'schedule-ml-v0',
  0,
  false
)
ON CONFLICT (experiment_key) DO NOTHING;

ALTER TABLE public.schedule_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_signal_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_schedule_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_opportunity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_optimization_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_profiles_admin ON public.schedule_profiles;
CREATE POLICY schedule_profiles_admin ON public.schedule_profiles
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS schedule_weights_admin ON public.schedule_signal_weights;
CREATE POLICY schedule_weights_admin ON public.schedule_signal_weights
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS schedule_history_select ON public.schedule_history;
CREATE POLICY schedule_history_select ON public.schedule_history
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS schedule_recs_select ON public.schedule_recommendations;
CREATE POLICY schedule_recs_select ON public.schedule_recommendations
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS schedule_recs_update ON public.schedule_recommendations;
CREATE POLICY schedule_recs_update ON public.schedule_recommendations
  FOR UPDATE TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS capacity_history_select ON public.capacity_history;
CREATE POLICY capacity_history_select ON public.capacity_history
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS capacity_pred_select ON public.capacity_predictions;
CREATE POLICY capacity_pred_select ON public.capacity_predictions
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS schedule_expl_select ON public.schedule_explanations;
CREATE POLICY schedule_expl_select ON public.schedule_explanations
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS provider_routes_select ON public.provider_routes;
CREATE POLICY provider_routes_select ON public.provider_routes
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS schedule_gaps_select ON public.provider_schedule_gaps;
CREATE POLICY schedule_gaps_select ON public.provider_schedule_gaps
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS provider_opps_rw ON public.provider_opportunities;
CREATE POLICY provider_opps_rw ON public.provider_opportunities
  FOR ALL TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS opp_history_select ON public.provider_opportunity_history;
CREATE POLICY opp_history_select ON public.provider_opportunity_history
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS route_cache_admin ON public.route_optimization_cache;
CREATE POLICY route_cache_admin ON public.route_optimization_cache
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS schedule_experiments_admin ON public.schedule_experiments;
CREATE POLICY schedule_experiments_admin ON public.schedule_experiments
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

COMMENT ON TABLE public.schedule_history IS
  'Sprint 8 Phase 4 — AI schedule optimizations (advisory only).';
COMMENT ON TABLE public.provider_opportunities IS
  'Gap-fill / idle-time opportunities — provider decides; never auto-book.';
