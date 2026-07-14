-- Dalily AI — Admin audit log (Sprint 6)

CREATE TYPE public.audit_action AS ENUM (
  'provider_approved',
  'provider_rejected',
  'provider_activated',
  'provider_suspended',
  'provider_archived',
  'provider_deleted',
  'user_role_changed',
  'user_disabled',
  'user_activated'
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.users (id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only platform admins may read audit logs (service role bypasses RLS for writes)
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
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
