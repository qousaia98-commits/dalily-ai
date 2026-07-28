-- Sprint 8 Phase 6 — AI Marketplace Intelligence Platform
-- Advisory only — simulations never affect production.

CREATE TABLE IF NOT EXISTS public.marketplace_algorithm_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL,
  algorithm_version TEXT NOT NULL,
  engine_kind TEXT NOT NULL DEFAULT 'rule'
    CHECK (engine_kind IN ('rule', 'ml', 'predictive', 'simulation', 'agent')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_key, algorithm_version)
);

CREATE INDEX IF NOT EXISTS marketplace_algo_module_idx
  ON public.marketplace_algorithm_versions (module_key, enabled);

CREATE TABLE IF NOT EXISTS public.marketplace_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_key TEXT NOT NULL DEFAULT 'global',
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  growth_index NUMERIC(8,4),
  liquidity_index NUMERIC(8,4),
  health_score NUMERIC(8,4),
  demand_index NUMERIC(8,4),
  supply_index NUMERIC(8,4),
  algorithm_version TEXT NOT NULL DEFAULT 'market-intel-v1',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (snapshot_key)
);

CREATE TABLE IF NOT EXISTS public.marketplace_category_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key TEXT NOT NULL,
  growth NUMERIC(8,4),
  demand NUMERIC(8,4),
  provider_density NUMERIC(8,4),
  competition NUMERIC(8,4),
  average_pricing NUMERIC(14,2),
  completion_rate NUMERIC(8,4),
  quality NUMERIC(8,4),
  trust NUMERIC(8,4),
  profitability NUMERIC(8,4),
  seasonality JSONB NOT NULL DEFAULT '{}'::jsonb,
  peak_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  forecast JSONB NOT NULL DEFAULT '{}'::jsonb,
  opportunity_score NUMERIC(8,4),
  risk_score NUMERIC(8,4),
  summary_en TEXT,
  summary_ar TEXT,
  algorithm_version TEXT NOT NULL DEFAULT 'market-intel-v1',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_key)
);

CREATE INDEX IF NOT EXISTS marketplace_cat_opp_idx
  ON public.marketplace_category_metrics (opportunity_score DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.marketplace_region_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_key TEXT NOT NULL,
  demand NUMERIC(8,4),
  supply NUMERIC(8,4),
  competition NUMERIC(8,4),
  growth NUMERIC(8,4),
  provider_density NUMERIC(8,4),
  avg_response_min NUMERIC(10,2),
  avg_travel_km NUMERIC(10,2),
  average_pricing NUMERIC(14,2),
  customer_satisfaction NUMERIC(8,4),
  complaint_rate NUMERIC(8,4),
  forecast JSONB NOT NULL DEFAULT '{}'::jsonb,
  opportunity_score NUMERIC(8,4),
  expansion_potential NUMERIC(8,4),
  heatmap JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary_en TEXT,
  summary_ar TEXT,
  algorithm_version TEXT NOT NULL DEFAULT 'market-intel-v1',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region_key)
);

CREATE INDEX IF NOT EXISTS marketplace_region_opp_idx
  ON public.marketplace_region_metrics (opportunity_score DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.marketplace_heatmaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_key TEXT NOT NULL,
  metric_key TEXT NOT NULL DEFAULT 'demand',
  cells JSONB NOT NULL DEFAULT '[]'::jsonb,
  algorithm_version TEXT NOT NULL DEFAULT 'market-intel-v1',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region_key, metric_key)
);

CREATE TABLE IF NOT EXISTS public.marketplace_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'general'
    CHECK (kind IN (
      'growing_category', 'underserved_region', 'high_demand_neighborhood',
      'provider_shortage', 'premium', 'partnership', 'enterprise',
      'recurring', 'cross_category', 'expansion', 'general'
    )),
  title_en TEXT NOT NULL,
  title_ar TEXT,
  body_en TEXT,
  body_ar TEXT,
  region_key TEXT,
  category_key TEXT,
  score NUMERIC(8,4) NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'accepted', 'dismissed', 'expired')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL DEFAULT 'market-intel-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID
);

CREATE INDEX IF NOT EXISTS marketplace_opp_status_idx
  ON public.marketplace_opportunities (status, score DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audience TEXT NOT NULL DEFAULT 'admin'
    CHECK (audience IN ('admin', 'provider', 'customer', 'executive')),
  subject_id UUID,
  code TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  reason_en TEXT,
  reason_ar TEXT,
  expected_impact TEXT,
  confidence NUMERIC(8,4) NOT NULL DEFAULT 0.5,
  required_effort TEXT,
  estimated_roi NUMERIC(8,4),
  estimated_time TEXT,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  algorithm_version TEXT NOT NULL DEFAULT 'market-intel-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID,
  audit_log JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS marketplace_recs_audience_idx
  ON public.marketplace_recommendations (audience, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL
    CHECK (report_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'ad_hoc')),
  period_start DATE,
  period_end DATE,
  summary_en TEXT NOT NULL,
  summary_ar TEXT,
  key_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
  predictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(8,4),
  trend_direction TEXT
    CHECK (trend_direction IN ('rising', 'stable', 'declining')),
  algorithm_version TEXT NOT NULL DEFAULT 'market-intel-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_reports_type_idx
  ON public.marketplace_reports (report_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.marketplace_executive_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.marketplace_reports(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  executive_summary_en TEXT NOT NULL,
  executive_summary_ar TEXT,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  restricted BOOLEAN NOT NULL DEFAULT true,
  algorithm_version TEXT NOT NULL DEFAULT 'market-intel-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  scenario_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (scenario_type IN (
      'provider_count', 'response_time', 'pricing_weights', 'matching_algorithm',
      'reputation_weights', 'new_category', 'new_city', 'custom'
    )),
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  impact_summary_en TEXT,
  impact_summary_ar TEXT,
  affects_production BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'completed', 'failed', 'archived')),
  algorithm_version TEXT NOT NULL DEFAULT 'market-sim-v1',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS marketplace_sims_created_idx
  ON public.marketplace_simulations (created_at DESC);

-- Hard guard: production isolation
ALTER TABLE public.marketplace_simulations
  DROP CONSTRAINT IF EXISTS marketplace_simulations_no_prod;
ALTER TABLE public.marketplace_simulations
  ADD CONSTRAINT marketplace_simulations_no_prod
  CHECK (affects_production = false);

CREATE TABLE IF NOT EXISTS public.marketplace_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES public.marketplace_recommendations(id) ON DELETE SET NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  reason_en TEXT,
  expected_impact TEXT,
  confidence NUMERIC(8,4),
  required_effort TEXT,
  estimated_roi NUMERIC(8,4),
  estimated_time TEXT,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'rejected', 'deferred')),
  audit_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  decided_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.marketplace_knowledge_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL
    CHECK (node_type IN (
      'provider', 'customer', 'booking', 'category', 'region', 'payment',
      'review', 'quality_case', 'fraud_investigation', 'trust', 'forecast',
      'pricing', 'scheduling', 'business_metric', 'marketplace_event', 'other'
    )),
  node_key TEXT NOT NULL,
  label TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_only BOOLEAN NOT NULL DEFAULT true,
  algorithm_version TEXT NOT NULL DEFAULT 'market-kg-v1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (node_type, node_key)
);

CREATE INDEX IF NOT EXISTS marketplace_kg_type_idx
  ON public.marketplace_knowledge_graph (node_type);

INSERT INTO public.marketplace_algorithm_versions
  (module_key, algorithm_version, engine_kind, enabled, is_default, notes)
VALUES
  ('global_analysis', 'market-intel-v1', 'rule', true, true, 'Global marketplace KPIs'),
  ('category_intel', 'market-intel-v1', 'rule', true, true, 'Category intelligence'),
  ('regional_intel', 'market-intel-v1', 'rule', true, true, 'Regional intelligence'),
  ('opportunity_engine', 'market-intel-v1', 'rule', true, true, 'Opportunity detection'),
  ('executive_reports', 'market-intel-v1', 'rule', true, true, 'Executive reports'),
  ('digital_twin', 'market-sim-v1', 'simulation', true, true, 'Isolated simulations'),
  ('decision_support', 'market-intel-v1', 'rule', true, true, 'Strategic recommendations'),
  ('knowledge_graph', 'market-kg-v1', 'rule', true, true, 'Internal knowledge graph'),
  ('provider_insights', 'market-intel-v1', 'rule', true, true, 'Provider market insights'),
  ('customer_insights', 'market-intel-v1', 'rule', true, true, 'Optional customer insights'),
  ('ml_ensemble', 'market-ml-v0', 'ml', false, false, 'ML-ready shadow model'),
  ('strategy_agent', 'agent-v0', 'agent', false, false, 'Future Marketplace Strategy Agent')
ON CONFLICT (module_key, algorithm_version) DO NOTHING;

-- RLS: admin-centric; provider/customer only own audience rows where applicable
ALTER TABLE public.marketplace_algorithm_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_category_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_region_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_heatmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_executive_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_knowledge_graph ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketplace_algo_admin ON public.marketplace_algorithm_versions;
CREATE POLICY marketplace_algo_admin ON public.marketplace_algorithm_versions
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_intel_admin ON public.marketplace_intelligence;
CREATE POLICY marketplace_intel_admin ON public.marketplace_intelligence
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_cat_admin ON public.marketplace_category_metrics;
CREATE POLICY marketplace_cat_admin ON public.marketplace_category_metrics
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_region_admin ON public.marketplace_region_metrics;
CREATE POLICY marketplace_region_admin ON public.marketplace_region_metrics
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_heat_admin ON public.marketplace_heatmaps;
CREATE POLICY marketplace_heat_admin ON public.marketplace_heatmaps
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_opp_admin ON public.marketplace_opportunities;
CREATE POLICY marketplace_opp_admin ON public.marketplace_opportunities
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_recs_access ON public.marketplace_recommendations;
CREATE POLICY marketplace_recs_access ON public.marketplace_recommendations
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR (
      audience = 'provider'
      AND subject_id IN (SELECT id FROM public.providers WHERE owner_id = auth.uid())
    )
    OR (
      audience = 'customer'
      AND subject_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS marketplace_recs_admin_write ON public.marketplace_recommendations;
CREATE POLICY marketplace_recs_admin_write ON public.marketplace_recommendations
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_reports_admin ON public.marketplace_reports;
CREATE POLICY marketplace_reports_admin ON public.marketplace_reports
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_exec_admin ON public.marketplace_executive_reports;
CREATE POLICY marketplace_exec_admin ON public.marketplace_executive_reports
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_sims_admin ON public.marketplace_simulations;
CREATE POLICY marketplace_sims_admin ON public.marketplace_simulations
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_decisions_admin ON public.marketplace_decisions;
CREATE POLICY marketplace_decisions_admin ON public.marketplace_decisions
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS marketplace_kg_admin ON public.marketplace_knowledge_graph;
CREATE POLICY marketplace_kg_admin ON public.marketplace_knowledge_graph
  FOR ALL TO authenticated
  USING (public.has_role('admin') AND internal_only = true)
  WITH CHECK (public.has_role('admin'));

COMMENT ON TABLE public.marketplace_simulations IS
  'Digital twin — isolated; affects_production must remain false.';
COMMENT ON TABLE public.marketplace_knowledge_graph IS
  'Internal AI knowledge graph — admin/internal only.';
COMMENT ON TABLE public.marketplace_executive_reports IS
  'Restricted executive dashboards — admin role required.';
