-- Sprint 7 Phase 6 — AI Operations & Platform Health
-- Admin-only operational intelligence: health, trends, anomalies, alerts.

CREATE TABLE IF NOT EXISTS public.platform_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period TEXT NOT NULL DEFAULT 'realtime'
    CHECK (period IN ('realtime', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  active_users INTEGER NOT NULL DEFAULT 0,
  bookings_today INTEGER NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  open_cases INTEGER NOT NULL DEFAULT 0,
  escalated_cases INTEGER NOT NULL DEFAULT 0,
  fraud_alerts INTEGER NOT NULL DEFAULT 0,
  trust_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_pending INTEGER NOT NULL DEFAULT 0,
  verification_verified INTEGER NOT NULL DEFAULT 0,
  review_count_period INTEGER NOT NULL DEFAULT 0,
  payment_success_rate NUMERIC(8,4),
  refund_rate NUMERIC(8,4),
  system_health TEXT NOT NULL DEFAULT 'healthy'
    CHECK (system_health IN ('healthy', 'degraded', 'critical')),
  overall_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_health_metrics_snapshot_idx
  ON public.platform_health_metrics (period, snapshot_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_type TEXT NOT NULL
    CHECK (anomaly_type IN (
      'refund_spike', 'review_spike', 'booking_drop',
      'category_anomaly', 'regional_anomaly', 'payment_anomaly',
      'complaint_spike', 'verification_failures', 'fraud_spike',
      'other'
    )),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  summary TEXT,
  metric_key TEXT,
  baseline_value NUMERIC(14,4),
  current_value NUMERIC(14,4),
  deviation_pct NUMERIC(10,4),
  scope_type TEXT
    CHECK (scope_type IS NULL OR scope_type IN ('platform', 'category', 'region', 'entity')),
  scope_id TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  false_positive BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS platform_anomalies_open_idx
  ON public.platform_anomalies (detected_at DESC)
  WHERE resolved_at IS NULL AND false_positive = false;

CREATE TABLE IF NOT EXISTS public.platform_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  source TEXT NOT NULL DEFAULT 'rule'
    CHECK (source IN ('rule', 'anomaly', 'manual', 'system')),
  anomaly_id UUID REFERENCES public.platform_anomalies(id) ON DELETE SET NULL,
  threshold_value NUMERIC(14,4),
  current_value NUMERIC(14,4),
  assigned_admin_id UUID,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_alerts_status_idx
  ON public.platform_alerts (status, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL,
  period TEXT NOT NULL
    CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  value NUMERIC(14,4) NOT NULL DEFAULT 0,
  previous_value NUMERIC(14,4),
  change_pct NUMERIC(10,4),
  direction TEXT NOT NULL DEFAULT 'stable'
    CHECK (direction IN ('up', 'down', 'stable')),
  scope_type TEXT NOT NULL DEFAULT 'platform'
    CHECK (scope_type IN ('platform', 'category', 'region')),
  scope_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (metric_key, period, period_start, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS platform_trends_lookup_idx
  ON public.platform_trends (metric_key, period, period_start DESC);

CREATE TABLE IF NOT EXISTS public.category_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT NOT NULL,
  category_name TEXT,
  trust_level TEXT NOT NULL DEFAULT 'developing'
    CHECK (trust_level IN (
      'excellent', 'very_good', 'good', 'developing', 'new_provider', 'needs_attention'
    )),
  growth_pct NUMERIC(10,4),
  complaint_rate NUMERIC(8,4),
  cancellation_rate NUMERIC(8,4),
  average_rating NUMERIC(4,2),
  completion_rate NUMERIC(8,4),
  customer_satisfaction NUMERIC(4,2),
  booking_count INTEGER NOT NULL DEFAULT 0,
  provider_count INTEGER NOT NULL DEFAULT 0,
  health_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id)
);

CREATE TABLE IF NOT EXISTS public.region_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_key TEXT NOT NULL,
  region_name TEXT,
  provider_density INTEGER NOT NULL DEFAULT 0,
  demand_count INTEGER NOT NULL DEFAULT 0,
  avg_response_hours NUMERIC(10,2),
  complaint_rate NUMERIC(8,4),
  trust_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  booking_count INTEGER NOT NULL DEFAULT 0,
  health_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (region_key)
);

CREATE TABLE IF NOT EXISTS public.platform_ops_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_admin_id UUID,
  created_by UUID,
  alert_id UUID REFERENCES public.platform_alerts(id) ON DELETE SET NULL,
  related_href TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS platform_ops_tasks_status_idx
  ON public.platform_ops_tasks (status, priority, created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_ops_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id UUID,
  entity_type TEXT,
  entity_id TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_ops_audit_idx
  ON public.platform_ops_audit (created_at DESC);

REVOKE UPDATE, DELETE ON public.platform_ops_audit FROM authenticated, anon;

-- Admin-only RLS
ALTER TABLE public.platform_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.region_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ops_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_ops_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_health_admin ON public.platform_health_metrics;
CREATE POLICY platform_health_admin ON public.platform_health_metrics
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS platform_anomalies_admin ON public.platform_anomalies;
CREATE POLICY platform_anomalies_admin ON public.platform_anomalies
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS platform_alerts_admin ON public.platform_alerts;
CREATE POLICY platform_alerts_admin ON public.platform_alerts
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS platform_trends_admin ON public.platform_trends;
CREATE POLICY platform_trends_admin ON public.platform_trends
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS category_health_admin ON public.category_health;
CREATE POLICY category_health_admin ON public.category_health
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS region_health_admin ON public.region_health;
CREATE POLICY region_health_admin ON public.region_health
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS platform_ops_tasks_admin ON public.platform_ops_tasks;
CREATE POLICY platform_ops_tasks_admin ON public.platform_ops_tasks
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS platform_ops_audit_select ON public.platform_ops_audit;
CREATE POLICY platform_ops_audit_select ON public.platform_ops_audit
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS platform_ops_audit_insert ON public.platform_ops_audit;
CREATE POLICY platform_ops_audit_insert ON public.platform_ops_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin'));

COMMENT ON TABLE public.platform_health_metrics IS
  'Sprint 7 Phase 6 — persisted platform health snapshots (admin-only).';
COMMENT ON TABLE public.platform_alerts IS
  'Configurable operational alerts for ops teams.';
