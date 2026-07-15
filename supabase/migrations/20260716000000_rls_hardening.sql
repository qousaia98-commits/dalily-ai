-- Sprint 12: RLS hardening for beta launch

-- ---------------------------------------------------------------------------
-- user_roles: prevent self-assignment of privileged roles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_roles_insert_own" ON public.user_roles;

-- Roles are assigned only via service role (bootstrap / admin actions).

-- ---------------------------------------------------------------------------
-- users: prevent self-reactivation and email verification bypass
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_privileged_user_self_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id
     AND NOT (public.has_role('admin') OR public.has_role('moderator')) THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'users.status cannot be changed by account owner';
    END IF;
    IF NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at THEN
      RAISE EXCEPTION 'users.email_verified_at cannot be changed by account owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_prevent_privileged_self_updates ON public.users;
CREATE TRIGGER users_prevent_privileged_self_updates
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privileged_user_self_updates();

-- ---------------------------------------------------------------------------
-- providers: prevent owners from self-activating or self-verifying
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_provider_privileged_self_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.owner_id
     AND NOT (public.has_role('admin') OR public.has_role('moderator')) THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'active' THEN
      RAISE EXCEPTION 'providers.status cannot be set to active by owner';
    END IF;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
       AND NEW.verification_status IN ('verified', 'partially_verified') THEN
      RAISE EXCEPTION 'providers.verification_status cannot be escalated by owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS providers_prevent_privileged_self_updates ON public.providers;
CREATE TRIGGER providers_prevent_privileged_self_updates
  BEFORE UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_provider_privileged_self_updates();

-- ---------------------------------------------------------------------------
-- provider_verifications: owners may only submit pending records
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "provider_verifications_insert_own" ON public.provider_verifications;
CREATE POLICY "provider_verifications_insert_own" ON public.provider_verifications
  FOR INSERT
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_verifications.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "provider_verifications_update_own" ON public.provider_verifications;
CREATE POLICY "provider_verifications_update_own" ON public.provider_verifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_verifications.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    AND (
      provider_verifications.status = 'rejected'
      OR (
        provider_verifications.status = 'pending'
        AND provider_verifications.reviewed_at IS NULL
      )
    )
  )
  WITH CHECK (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_verifications.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );
