-- Sprint 10 Phase 5: Enterprise AI Platform
-- Observability, cache, prompt templates, moderation recommendations.
-- Extends existing ai_* tables; does not replace engines.

-- Provider-agnostic usage / cost observability
CREATE TABLE IF NOT EXISTS public.ai_platform_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL
    CHECK (feature = ANY (ARRAY[
      'assistant'::text, 'pricing'::text, 'matching'::text, 'translation'::text,
      'summary'::text, 'fraud'::text, 'moderation'::text, 'analytics'::text,
      'forecast'::text, 'scheduler'::text, 'knowledge'::text, 'other'::text
    ])),
  provider_id text NOT NULL DEFAULT 'mock',
  model text,
  success boolean NOT NULL DEFAULT true,
  latency_ms integer,
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost_usd numeric(12,6),
  error_code text,
  fallback_used boolean NOT NULL DEFAULT false,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_platform_usage_feature_idx
  ON public.ai_platform_usage (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_platform_usage_provider_idx
  ON public.ai_platform_usage (provider_id, created_at DESC);

ALTER TABLE public.ai_platform_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_platform_usage_admin ON public.ai_platform_usage
  FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role))
  WITH CHECK (public.has_role('admin'::public.app_role));

-- Response cache (reuse; never stores secrets)
CREATE TABLE IF NOT EXISTS public.ai_platform_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  feature text NOT NULL,
  locale text,
  payload jsonb NOT NULL,
  provider_id text,
  expires_at timestamptz NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_platform_cache_key_unique UNIQUE (cache_key)
);

CREATE INDEX IF NOT EXISTS ai_platform_cache_expires_idx
  ON public.ai_platform_cache (expires_at);

ALTER TABLE public.ai_platform_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_platform_cache_admin ON public.ai_platform_cache
  FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role))
  WITH CHECK (public.has_role('admin'::public.app_role));

-- Prompt templates (ops-tunable; no hardcoded product policy in UI)
CREATE TABLE IF NOT EXISTS public.ai_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  feature text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  system_prompt text NOT NULL,
  user_template text,
  enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_prompt_templates_admin ON public.ai_prompt_templates
  FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role))
  WITH CHECK (public.has_role('admin'::public.app_role));

CREATE POLICY ai_prompt_templates_select_auth ON public.ai_prompt_templates
  FOR SELECT TO authenticated
  USING (enabled = true OR public.has_role('admin'::public.app_role));

INSERT INTO public.ai_prompt_templates (code, name, feature, system_prompt)
VALUES
  (
    'assistant_customer_default',
    'Customer assistant system',
    'assistant',
    'You are Dalily''s customer assistant. Recommend and explain. Never submit requests or make decisions for the user.'
  ),
  (
    'assistant_provider_default',
    'Provider assistant system',
    'assistant',
    'You are Dalily''s provider assistant. Draft and suggest only. Never send messages or offers automatically.'
  ),
  (
    'moderation_default',
    'Moderation recommender',
    'moderation',
    'Analyze content for policy risks. Output recommendations only — never ban or delete automatically.'
  )
ON CONFLICT (code) DO NOTHING;

-- Moderation recommendations (never auto-enforce)
CREATE TABLE IF NOT EXISTS public.ai_moderation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text NOT NULL
    CHECK (target_type = ANY (ARRAY[
      'message'::text, 'review'::text, 'image'::text, 'description'::text,
      'portfolio'::text, 'offer'::text, 'profile'::text, 'other'::text
    ])),
  target_id text,
  risk_level text NOT NULL DEFAULT 'low'
    CHECK (risk_level = ANY (ARRAY[
      'low'::text, 'medium'::text, 'high'::text, 'critical'::text
    ])),
  categories text[] NOT NULL DEFAULT '{}',
  reasons text[] NOT NULL DEFAULT '{}',
  suggested_action text NOT NULL DEFAULT 'review'
    CHECK (suggested_action = ANY (ARRAY[
      'allow'::text, 'review'::text, 'hide'::text, 'escalate'::text
    ])),
  confidence numeric(5,4) NOT NULL DEFAULT 0,
  provider_id text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status = ANY (ARRAY[
      'open'::text, 'acknowledged'::text, 'resolved'::text, 'dismissed'::text
    ])),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ai_moderation_reports_status_idx
  ON public.ai_moderation_reports (status, created_at DESC);

ALTER TABLE public.ai_moderation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_moderation_reports_admin ON public.ai_moderation_reports
  FOR ALL TO authenticated
  USING (public.has_role('admin'::public.app_role))
  WITH CHECK (public.has_role('admin'::public.app_role));

-- Analytics snapshots for admin AI center
CREATE TABLE IF NOT EXISTS public.ai_analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type text NOT NULL,
  period text NOT NULL DEFAULT 'daily',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_analytics_snapshots_type_idx
  ON public.ai_analytics_snapshots (snapshot_type, computed_at DESC);

ALTER TABLE public.ai_analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_analytics_snapshots_admin ON public.ai_analytics_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role('admin'::public.app_role));

GRANT ALL ON TABLE public.ai_platform_usage TO authenticated, service_role;
GRANT ALL ON TABLE public.ai_platform_cache TO authenticated, service_role;
GRANT ALL ON TABLE public.ai_prompt_templates TO authenticated, service_role;
GRANT ALL ON TABLE public.ai_moderation_reports TO authenticated, service_role;
GRANT ALL ON TABLE public.ai_analytics_snapshots TO authenticated, service_role;

COMMENT ON TABLE public.ai_platform_usage IS 'Sprint 10 Phase 5: AI provider usage & cost observability.';
COMMENT ON TABLE public.ai_moderation_reports IS 'Sprint 10 Phase 5: moderation recommendations only — never auto-ban.';
