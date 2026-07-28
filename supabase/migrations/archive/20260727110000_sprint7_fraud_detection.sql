-- Sprint 7 Phase 5 — Fraud Detection & Risk Intelligence
-- Admin-only risk scoring, investigations, relationship graph. Never auto-suspend.

CREATE TABLE IF NOT EXISTS public.risk_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL
    CHECK (category IN (
      'identity', 'payment', 'review', 'booking', 'messaging',
      'device', 'location', 'policy', 'ml', 'other'
    )),
  title TEXT NOT NULL,
  description TEXT,
  weight NUMERIC(8,4) NOT NULL DEFAULT 1.0,
  threshold NUMERIC(8,4) NOT NULL DEFAULT 0.5,
  enabled BOOLEAN NOT NULL DEFAULT true,
  ml_ready BOOLEAN NOT NULL DEFAULT false,
  auto_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fraud_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'multiple_provider_accounts', 'multiple_customer_accounts',
      'repeated_failed_payments', 'abnormal_refund_behaviour',
      'fake_review_network', 'rating_manipulation',
      'repeated_cancelled_bookings', 'no_show_patterns',
      'suspicious_messaging', 'rapid_account_creation',
      'device_anomaly', 'location_anomaly',
      'repeated_identity_changes', 'policy_violation',
      'rule_extension', 'other'
    )),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN (
      'provider', 'customer', 'booking', 'payment', 'review', 'case', 'account'
    )),
  entity_id TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  rule_key TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  related_entity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'rule'
    CHECK (source IN ('rule', 'heuristic', 'ml', 'manual', 'system')),
  investigation_id UUID,
  resolved_at TIMESTAMPTZ,
  false_positive BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fraud_events_entity_idx
  ON public.fraud_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_events_type_idx
  ON public.fraud_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_events_open_idx
  ON public.fraud_events (created_at DESC)
  WHERE resolved_at IS NULL AND false_positive = false;

CREATE TABLE IF NOT EXISTS public.risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL
    CHECK (entity_type IN (
      'provider', 'customer', 'booking', 'payment', 'review', 'case', 'account'
    )),
  entity_id TEXT NOT NULL,
  internal_score NUMERIC(8,4) NOT NULL DEFAULT 0
    CHECK (internal_score >= 0 AND internal_score <= 100),
  risk_level TEXT NOT NULL DEFAULT 'low'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  explanation TEXT,
  triggered_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_action TEXT,
  related_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  duplicate_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  signal_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_version TEXT NOT NULL DEFAULT 'fraud-rules-v1',
  ml_contribution NUMERIC(8,4) NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS risk_scores_level_idx
  ON public.risk_scores (risk_level, internal_score DESC);

CREATE TABLE IF NOT EXISTS public.risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  from_score NUMERIC(8,4),
  to_score NUMERIC(8,4) NOT NULL,
  from_level TEXT,
  to_level TEXT NOT NULL,
  triggered_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  actor_id UUID,
  actor_role TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS risk_score_history_entity_idx
  ON public.risk_score_history (entity_type, entity_id, created_at DESC);

REVOKE UPDATE, DELETE ON public.risk_score_history FROM authenticated, anon;

CREATE TABLE IF NOT EXISTS public.investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN (
      'open', 'in_progress', 'awaiting_info', 'escalated',
      'resolved', 'closed', 'false_positive'
    )),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  primary_entity_type TEXT NOT NULL,
  primary_entity_id TEXT NOT NULL,
  related_entity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_admin_id UUID,
  outcome TEXT,
  merged_into_id UUID REFERENCES public.investigations(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS investigations_status_idx
  ON public.investigations (status, priority, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.investigation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT,
  action TEXT NOT NULL,
  actor_id UUID,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigation_history_idx
  ON public.investigation_history (investigation_id, created_at);

REVOKE UPDATE, DELETE ON public.investigation_history FROM authenticated, anon;

CREATE TABLE IF NOT EXISTS public.investigation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investigation_notes_idx
  ON public.investigation_notes (investigation_id, created_at);

CREATE TABLE IF NOT EXISTS public.entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_type TEXT NOT NULL,
  from_entity_id TEXT NOT NULL,
  to_entity_type TEXT NOT NULL,
  to_entity_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL
    CHECK (relationship_type IN (
      'same_owner', 'same_payment_method', 'shared_booking',
      'shared_review', 'shared_device', 'shared_ip',
      'linked_case', 'verification_link', 'duplicate_candidate',
      'investigation_link', 'other'
    )),
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_entity_type, from_entity_id, to_entity_type, to_entity_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS entity_relationships_from_idx
  ON public.entity_relationships (from_entity_type, from_entity_id)
  WHERE confirmed = true;
CREATE INDEX IF NOT EXISTS entity_relationships_to_idx
  ON public.entity_relationships (to_entity_type, to_entity_id)
  WHERE confirmed = true;

ALTER TABLE public.fraud_events
  DROP CONSTRAINT IF EXISTS fraud_events_investigation_id_fkey;
ALTER TABLE public.fraud_events
  ADD CONSTRAINT fraud_events_investigation_id_fkey
  FOREIGN KEY (investigation_id) REFERENCES public.investigations(id) ON DELETE SET NULL;

CREATE SEQUENCE IF NOT EXISTS public.investigation_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.next_investigation_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n BIGINT;
BEGIN
  n := nextval('public.investigation_number_seq');
  RETURN 'INV-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::TEXT, 5, '0');
END;
$$;

-- Seed default rules (idempotent)
INSERT INTO public.risk_rules (rule_key, category, title, description, weight, threshold, auto_actions)
VALUES
  ('multiple_provider_accounts', 'identity', 'Multiple provider accounts', 'Same owner signals across providers', 1.4, 0.6, '["flag_account","escalate_to_admin"]'::jsonb),
  ('multiple_customer_accounts', 'identity', 'Multiple customer accounts', 'Duplicate customer identity patterns', 1.2, 0.6, '["flag_account","require_manual_review"]'::jsonb),
  ('repeated_failed_payments', 'payment', 'Repeated failed payments', 'Burst of failed payment attempts', 1.3, 0.55, '["require_manual_review","temporary_feature_restriction"]'::jsonb),
  ('abnormal_refund_behaviour', 'payment', 'Abnormal refund behaviour', 'High refund rate or velocity', 1.5, 0.5, '["flag_account","escalate_to_admin"]'::jsonb),
  ('fake_review_network', 'review', 'Fake review network', 'Coordinated or duplicate review signals', 1.6, 0.55, '["require_manual_review","escalate_to_admin"]'::jsonb),
  ('rating_manipulation', 'review', 'Rating manipulation', 'Sudden rating swings / self-boost patterns', 1.4, 0.55, '["require_manual_review"]'::jsonb),
  ('repeated_cancelled_bookings', 'booking', 'Repeated cancelled bookings', 'High cancel velocity', 1.1, 0.5, '["flag_account"]'::jsonb),
  ('no_show_patterns', 'booking', 'No-show patterns', 'Repeated no-shows', 1.2, 0.5, '["flag_account","require_manual_review"]'::jsonb),
  ('suspicious_messaging', 'messaging', 'Suspicious messaging', 'Spam / contact-share / abuse patterns', 1.0, 0.55, '["temporary_feature_restriction"]'::jsonb),
  ('rapid_account_creation', 'identity', 'Rapid account creation', 'Burst registration from related signals', 1.3, 0.6, '["require_manual_review","require_identity_reverification"]'::jsonb),
  ('device_anomaly', 'device', 'Device anomaly', 'Shared or spoofed device fingerprints', 1.1, 0.6, '["require_manual_review"]'::jsonb),
  ('location_anomaly', 'location', 'Location anomaly', 'Impossible travel / mismatch', 1.0, 0.65, '["require_manual_review"]'::jsonb),
  ('repeated_identity_changes', 'identity', 'Repeated identity changes', 'Frequent ID/document churn', 1.4, 0.55, '["require_identity_reverification","escalate_to_admin"]'::jsonb),
  ('policy_violation', 'policy', 'Policy violation', 'Confirmed marketplace policy breach', 1.5, 0.4, '["flag_account","escalate_to_admin"]'::jsonb)
ON CONFLICT (rule_key) DO NOTHING;

-- Admin-only RLS
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS risk_rules_admin ON public.risk_rules;
CREATE POLICY risk_rules_admin ON public.risk_rules
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS fraud_events_admin ON public.fraud_events;
CREATE POLICY fraud_events_admin ON public.fraud_events
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS risk_scores_admin ON public.risk_scores;
CREATE POLICY risk_scores_admin ON public.risk_scores
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS risk_history_admin_select ON public.risk_score_history;
CREATE POLICY risk_history_admin_select ON public.risk_score_history
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS risk_history_admin_insert ON public.risk_score_history;
CREATE POLICY risk_history_admin_insert ON public.risk_score_history
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS investigations_admin ON public.investigations;
CREATE POLICY investigations_admin ON public.investigations
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS investigation_history_admin_select ON public.investigation_history;
CREATE POLICY investigation_history_admin_select ON public.investigation_history
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

DROP POLICY IF EXISTS investigation_history_admin_insert ON public.investigation_history;
CREATE POLICY investigation_history_admin_insert ON public.investigation_history
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS investigation_notes_admin ON public.investigation_notes;
CREATE POLICY investigation_notes_admin ON public.investigation_notes
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS entity_relationships_admin ON public.entity_relationships;
CREATE POLICY entity_relationships_admin ON public.entity_relationships
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

COMMENT ON TABLE public.fraud_events IS
  'Sprint 7 Phase 5 — detected fraud / risk signals (admin-only).';
COMMENT ON TABLE public.risk_scores IS
  'Internal risk scores — never expose to customers.';
COMMENT ON TABLE public.risk_score_history IS
  'Immutable audit trail of risk score changes.';
