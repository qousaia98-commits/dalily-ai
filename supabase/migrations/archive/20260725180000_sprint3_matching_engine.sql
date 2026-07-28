-- Sprint 3 — Matching Engine (additive)
-- Scarce request allocation pools + assignments with explainability reason codes.
-- Does NOT alter subscription tables. Matching must never use plan tier for priority.

CREATE TABLE IF NOT EXISTS public.match_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  cell_key text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'expanded', 'closed', 'insufficient_supply')),
  expand_count integer NOT NULL DEFAULT 0,
  initial_candidate_count integer NOT NULL DEFAULT 0,
  assigned_count integer NOT NULL DEFAULT 0,
  policy_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_pools_one_per_request UNIQUE (service_request_id)
);

CREATE TABLE IF NOT EXISTS public.match_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.match_pools (id) ON DELETE CASCADE,
  service_request_id uuid NOT NULL REFERENCES public.service_requests (id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers (id) ON DELETE CASCADE,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  rank_in_pool integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'initial'
    CHECK (source IN ('initial', 'expand', 'newcomer')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT match_assignments_unique_provider UNIQUE (service_request_id, provider_id)
);

CREATE INDEX IF NOT EXISTS match_assignments_provider_idx
  ON public.match_assignments (provider_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS match_assignments_request_idx
  ON public.match_assignments (service_request_id, rank_in_pool);

CREATE INDEX IF NOT EXISTS match_pools_status_idx
  ON public.match_pools (status, created_at DESC);

COMMENT ON TABLE public.match_pools IS
  'Dalily 2.0 Matching Service — one pool per marketplace request (Sprint 3).';
COMMENT ON TABLE public.match_assignments IS
  'Dalily 2.0 scarce provider assignments with reason_codes. No subscription influence.';

ALTER TABLE public.match_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_assignments ENABLE ROW LEVEL SECURITY;

-- Customers can read pools/assignments for their own requests
DROP POLICY IF EXISTS match_pools_customer_select ON public.match_pools;
CREATE POLICY match_pools_customer_select ON public.match_pools
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = match_pools.service_request_id
        AND sr.customer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS match_assignments_customer_select ON public.match_assignments;
CREATE POLICY match_assignments_customer_select ON public.match_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = match_assignments.service_request_id
        AND sr.customer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = match_assignments.provider_id AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'moderator')
    )
  );

-- Providers can read their own assignments (dashboard wiring in Sprint 8)
DROP POLICY IF EXISTS match_assignments_provider_select ON public.match_assignments;
-- covered above via owner_id check on combined policy
