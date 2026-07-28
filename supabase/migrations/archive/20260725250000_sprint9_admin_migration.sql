-- Sprint 9 — Admin Migration (additive)
-- Cell policies for freeze / limited availability / concierge.
-- Flexible enforcement audit via existing admin_action_logs (no enum churn required).

CREATE TABLE IF NOT EXISTS public.cell_policies (
  cell_key text PRIMARY KEY,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  frozen boolean NOT NULL DEFAULT false,
  limited_availability boolean NOT NULL DEFAULT false,
  concierge boolean NOT NULL DEFAULT false,
  note text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cell_policies_flags_check CHECK (
    NOT (frozen AND limited_availability) OR true
  )
);

COMMENT ON TABLE public.cell_policies IS
  'Sprint 9: city×category marketplace cell overrides. frozen blocks matching; limited_availability shrinks pool; concierge marks ops-assisted cells.';

CREATE INDEX IF NOT EXISTS cell_policies_frozen_idx
  ON public.cell_policies (frozen)
  WHERE frozen = true;

ALTER TABLE public.cell_policies ENABLE ROW LEVEL SECURITY;

-- No authenticated client policies — reads/writes via service role (admin domain).
DROP POLICY IF EXISTS cell_policies_admin_select ON public.cell_policies;
-- Intentionally no TO authenticated policies; admin client bypasses RLS.

-- Optional: track last enforcement on unlock sessions for ops visibility (additive metadata only)
ALTER TABLE public.unlock_sessions
  ADD COLUMN IF NOT EXISTS admin_comp_reason text;

COMMENT ON COLUMN public.unlock_sessions.admin_comp_reason IS
  'Sprint 9: set when grant issued via audited admin_comp (reason required in action log).';
