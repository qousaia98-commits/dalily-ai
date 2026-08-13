-- Dalily AI — Search analytics (MVP)
-- Logs every search for analytics and future AI training data.

CREATE TYPE public.problem_priority AS ENUM ('emergency', 'high', 'normal', 'low');

CREATE TABLE public.search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users (id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  normalized_query TEXT,
  problem_id VARCHAR(80),
  category_slug VARCHAR(80),
  city_slug VARCHAR(80),
  priority public.problem_priority,
  result_count SMALLINT NOT NULL DEFAULT 0,
  provider_ids UUID[] NOT NULL DEFAULT '{}',
  locale VARCHAR(10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX search_logs_created_at_idx ON public.search_logs (created_at DESC);
CREATE INDEX search_logs_problem_id_idx ON public.search_logs (problem_id) WHERE problem_id IS NOT NULL;
CREATE INDEX search_logs_user_id_idx ON public.search_logs (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous + authenticated searches)
CREATE POLICY "search_logs_insert_all" ON public.search_logs
  FOR INSERT
  WITH CHECK (true);

-- Only admins can read search logs
CREATE POLICY "search_logs_select_admin" ON public.search_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND revoked_at IS NULL
    )
  );
