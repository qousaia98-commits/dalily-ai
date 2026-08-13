-- Sprint 7 Phase 3 — AI Reputation Engine
-- Internal scores never public; customers see trust levels + positive explanations only.

CREATE TABLE IF NOT EXISTS public.provider_reputation_weights (
  signal_key TEXT PRIMARY KEY,
  category TEXT NOT NULL
    CHECK (category IN (
      'verification', 'reviews', 'booking', 'communication',
      'reliability', 'activity'
    )),
  weight NUMERIC(8,4) NOT NULL DEFAULT 1.0 CHECK (weight >= 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  ml_ready BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_reputation_scores (
  provider_id UUID PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  internal_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  trust_level TEXT NOT NULL DEFAULT 'new_provider'
    CHECK (trust_level IN (
      'excellent', 'very_good', 'good', 'developing',
      'new_provider', 'needs_attention'
    )),
  search_boost NUMERIC(6,4) NOT NULL DEFAULT 0,
  recommendation_boost NUMERIC(6,4) NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'stable'
    CHECK (trend IN ('rising', 'stable', 'declining')),
  signal_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  previous_score NUMERIC(6,2),
  previous_trust_level TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model_version TEXT NOT NULL DEFAULT 'reputation-engine-v1'
);

CREATE TABLE IF NOT EXISTS public.provider_reputation_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  signal_key TEXT NOT NULL,
  category TEXT NOT NULL,
  raw_value NUMERIC(12,4),
  normalized_value NUMERIC(8,4) NOT NULL DEFAULT 0,
  weight NUMERIC(8,4) NOT NULL DEFAULT 1,
  contribution NUMERIC(8,4) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'heuristic'
    CHECK (source IN ('heuristic', 'ml', 'manual', 'import')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, signal_key)
);

CREATE INDEX IF NOT EXISTS provider_reputation_signals_provider_idx
  ON public.provider_reputation_signals (provider_id, category);

CREATE TABLE IF NOT EXISTS public.provider_reputation_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  audience TEXT NOT NULL
    CHECK (audience IN ('public', 'provider', 'admin')),
  locale TEXT NOT NULL DEFAULT 'en',
  explanation_key TEXT,
  body TEXT NOT NULL,
  polarity TEXT NOT NULL DEFAULT 'positive'
    CHECK (polarity IN ('positive', 'neutral', 'improvement')),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  signal_key TEXT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_reputation_explanations_public_idx
  ON public.provider_reputation_explanations (provider_id, audience, locale)
  WHERE audience = 'public' AND polarity = 'positive';

CREATE TABLE IF NOT EXISTS public.provider_reputation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  period TEXT NOT NULL
    CHECK (period IN ('daily', 'weekly', 'monthly', 'snapshot')),
  internal_score NUMERIC(6,2) NOT NULL,
  trust_level TEXT NOT NULL,
  trend TEXT NOT NULL DEFAULT 'stable',
  signal_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_boost NUMERIC(6,4),
  recommendation_boost NUMERIC(6,4),
  important_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_reputation_history_provider_idx
  ON public.provider_reputation_history (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.provider_reputation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'reputation_recalculated', 'signal_updated', 'trust_level_changed',
      'search_boost_changed', 'recommendation_boost_changed',
      'trend_generated', 'manual_override'
    )),
  actor_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS provider_reputation_events_provider_idx
  ON public.provider_reputation_events (provider_id, created_at DESC);

-- Seed configurable weights (no hardcoded core logic dependence)
INSERT INTO public.provider_reputation_weights (signal_key, category, weight, description) VALUES
  ('identity_verified', 'verification', 1.2, 'Identity verification check'),
  ('address_verified', 'verification', 0.8, 'Address verification check'),
  ('business_verified', 'verification', 1.4, 'Business / overall verification'),
  ('professional_verified', 'verification', 1.0, 'Professional license / trade check'),
  ('document_freshness', 'verification', 0.6, 'Document freshness'),
  ('average_rating', 'reviews', 1.8, 'Lifetime average rating'),
  ('review_count', 'reviews', 1.0, 'Review volume'),
  ('recommendation_rate', 'reviews', 1.2, 'Would-recommend rate'),
  ('recent_reviews', 'reviews', 1.1, 'Recent rating quality'),
  ('provider_response_rate', 'reviews', 0.9, 'Provider reply rate'),
  ('review_quality', 'reviews', 0.7, 'Review depth / media quality'),
  ('completed_jobs', 'booking', 1.3, 'Completed jobs volume'),
  ('cancelled_jobs', 'booking', 0.8, 'Cancellation penalty (inverted)'),
  ('cancellation_rate', 'booking', 1.1, 'Low cancellation rate'),
  ('acceptance_rate', 'booking', 1.0, 'Offer/request acceptance'),
  ('completion_rate', 'booking', 1.4, 'Job completion rate'),
  ('repeat_customers', 'booking', 1.0, 'Repeat customer rate'),
  ('avg_booking_value', 'booking', 0.4, 'Normalized booking value'),
  ('avg_response_time', 'communication', 1.3, 'Fast average response'),
  ('response_consistency', 'communication', 0.8, 'Response consistency'),
  ('unread_requests', 'communication', 0.7, 'Low unread backlog'),
  ('late_replies', 'communication', 0.6, 'Few late replies'),
  ('on_time_arrival', 'reliability', 1.0, 'On-time arrival proxy'),
  ('customer_confirmations', 'reliability', 0.9, 'Customer confirmation rate'),
  ('complaint_rate', 'reliability', 1.2, 'Low complaint rate'),
  ('refund_rate', 'reliability', 0.9, 'Low refund rate'),
  ('disputes', 'reliability', 1.0, 'Low dispute rate'),
  ('policy_violations', 'reliability', 1.1, 'No policy violations'),
  ('profile_completeness', 'activity', 0.8, 'Profile completeness'),
  ('recent_activity', 'activity', 0.9, 'Recent platform activity'),
  ('login_frequency', 'activity', 0.4, 'Login / session activity proxy'),
  ('business_age', 'activity', 0.5, 'Account tenure'),
  ('marketplace_engagement', 'activity', 0.7, 'Marketplace engagement')
ON CONFLICT (signal_key) DO NOTHING;

ALTER TABLE public.provider_reputation_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reputation_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reputation_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reputation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reputation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reputation_weights_read ON public.provider_reputation_weights;
CREATE POLICY reputation_weights_read ON public.provider_reputation_weights
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS reputation_scores_owner_or_admin ON public.provider_reputation_scores;
CREATE POLICY reputation_scores_owner_or_admin ON public.provider_reputation_scores
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reputation_signals_owner_or_admin ON public.provider_reputation_signals;
CREATE POLICY reputation_signals_owner_or_admin ON public.provider_reputation_signals
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

-- Public may read only positive public explanations (no scores)
DROP POLICY IF EXISTS reputation_explanations_public ON public.provider_reputation_explanations;
CREATE POLICY reputation_explanations_public ON public.provider_reputation_explanations
  FOR SELECT TO authenticated
  USING (
    (audience = 'public' AND polarity = 'positive')
    OR public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reputation_history_owner_or_admin ON public.provider_reputation_history;
CREATE POLICY reputation_history_owner_or_admin ON public.provider_reputation_history
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reputation_events_admin ON public.provider_reputation_events;
CREATE POLICY reputation_events_admin ON public.provider_reputation_events
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

-- Public-safe view: trust level only (never internal_score)
CREATE OR REPLACE VIEW public.provider_public_trust AS
SELECT
  provider_id,
  trust_level,
  trend,
  computed_at
FROM public.provider_reputation_scores;

-- Allow authenticated users to read trust level via cache (scores stay owner/admin)
ALTER TABLE public.provider_reputation_cache
  ADD COLUMN IF NOT EXISTS trust_level TEXT,
  ADD COLUMN IF NOT EXISTS trend TEXT;

GRANT SELECT ON public.provider_public_trust TO authenticated;

COMMENT ON TABLE public.provider_reputation_scores IS
  'Sprint 7 Phase 3 — internal reputation scores. Never expose internal_score to customers.';
