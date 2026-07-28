-- Sprint 8 Phase 5 — AI Business Assistant
-- Recommendations only — providers always remain in control.

CREATE TABLE IF NOT EXISTS public.business_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  health_score NUMERIC(8,4) NOT NULL DEFAULT 0.5,
  revenue_score NUMERIC(8,4),
  booking_score NUMERIC(8,4),
  quality_score NUMERIC(8,4),
  trust_score NUMERIC(8,4),
  capacity_score NUMERIC(8,4),
  trend TEXT NOT NULL DEFAULT 'stable'
    CHECK (trend IN ('rising', 'stable', 'declining')),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id)
);

CREATE INDEX IF NOT EXISTS business_health_score_idx
  ON public.business_health (health_score DESC);

CREATE TABLE IF NOT EXISTS public.business_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  code TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN (
      'revenue', 'bookings', 'quality', 'growth', 'capacity', 'reputation', 'general'
    )),
  label_en TEXT NOT NULL,
  label_ar TEXT,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'positive', 'warning', 'critical')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL DEFAULT 'business-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_insights_provider_idx
  ON public.business_insights (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.business_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  code TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  body_en TEXT,
  body_ar TEXT,
  priority NUMERIC(8,4) NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL DEFAULT 'business-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS business_recs_provider_idx
  ON public.business_recommendations (provider_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.business_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  goal_type TEXT NOT NULL
    CHECK (goal_type IN (
      'revenue', 'bookings', 'rating', 'response_time', 'completion_rate', 'repeat_customers', 'custom'
    )),
  title TEXT NOT NULL,
  target_value NUMERIC(14,4) NOT NULL,
  current_value NUMERIC(14,4) NOT NULL DEFAULT 0,
  unit TEXT,
  period TEXT NOT NULL DEFAULT 'monthly'
    CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at DATE,
  ends_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_goals_provider_idx
  ON public.business_goals (provider_id, active);

CREATE TABLE IF NOT EXISTS public.business_goal_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.business_goals(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL,
  recorded_value NUMERIC(14,4) NOT NULL,
  progress_pct NUMERIC(8,4),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_goal_progress_goal_idx
  ON public.business_goal_progress (goal_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.business_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  region_key TEXT NOT NULL DEFAULT 'all',
  category_key TEXT NOT NULL DEFAULT 'all',
  cohort TEXT NOT NULL DEFAULT 'average'
    CHECK (cohort IN ('top_20', 'above_average', 'average', 'improving', 'below_average')),
  percentile NUMERIC(8,4),
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, region_key, category_key)
);

CREATE TABLE IF NOT EXISTS public.business_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  briefing_date DATE NOT NULL,
  summary_en TEXT NOT NULL,
  summary_ar TEXT,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL DEFAULT 'business-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS business_briefings_provider_idx
  ON public.business_briefings (provider_id, briefing_date DESC);

CREATE TABLE IF NOT EXISTS public.business_assistant_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  algorithm_a TEXT NOT NULL DEFAULT 'business-v1',
  algorithm_b TEXT NOT NULL DEFAULT 'business-ml-v0',
  traffic_b_pct NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (traffic_b_pct >= 0 AND traffic_b_pct <= 100),
  active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.business_assistant_experiments (experiment_key, title, description, algorithm_a, algorithm_b, traffic_b_pct, active)
VALUES (
  'business_assistant_default',
  'Rules vs ML-ready coaching',
  'A/B scaffold for business assistant versions',
  'business-v1',
  'business-ml-v0',
  0,
  false
)
ON CONFLICT (experiment_key) DO NOTHING;

ALTER TABLE public.business_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_goal_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_assistant_experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_health_select ON public.business_health;
CREATE POLICY business_health_select ON public.business_health
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS business_insights_select ON public.business_insights;
CREATE POLICY business_insights_select ON public.business_insights
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS business_recs_rw ON public.business_recommendations;
CREATE POLICY business_recs_rw ON public.business_recommendations
  FOR ALL TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS business_goals_rw ON public.business_goals;
CREATE POLICY business_goals_rw ON public.business_goals
  FOR ALL TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS business_goal_progress_rw ON public.business_goal_progress;
CREATE POLICY business_goal_progress_rw ON public.business_goal_progress
  FOR ALL TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS business_benchmarks_select ON public.business_benchmarks;
CREATE POLICY business_benchmarks_select ON public.business_benchmarks
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS business_briefings_select ON public.business_briefings;
CREATE POLICY business_briefings_select ON public.business_briefings
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR provider_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS business_assistant_experiments_admin ON public.business_assistant_experiments;
CREATE POLICY business_assistant_experiments_admin ON public.business_assistant_experiments
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

COMMENT ON TABLE public.business_health IS
  'Sprint 8 Phase 5 — provider business health (own data only).';
COMMENT ON TABLE public.business_benchmarks IS
  'Anonymous cohort labels only — never competitor identities.';
