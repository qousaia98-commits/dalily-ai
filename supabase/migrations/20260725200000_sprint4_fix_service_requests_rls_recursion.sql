-- Sprint 4 hotfix — break RLS recursion on service_requests SELECT
--
-- Root cause (runtime):
--   code 42P17
--   message: infinite recursion detected in policy for relation "service_requests"
--
-- 20260725195000 added match_assignments into service_requests_provider_select.
-- match_assignments RLS also reads service_requests → recursive policy evaluation
-- → customer INSERT ... RETURNING fails → publish_failed.
--
-- Fix: SECURITY DEFINER helper bypasses RLS for the boolean ownership check only.

CREATE OR REPLACE FUNCTION public.provider_owns_match_assignment_for_request(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_assignments ma
    JOIN public.providers p ON p.id = ma.provider_id
    WHERE ma.service_request_id = p_request_id
      AND p.owner_id = auth.uid()
      AND p.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.provider_owns_match_assignment_for_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_owns_match_assignment_for_request(uuid) TO authenticated;

DROP POLICY IF EXISTS "service_requests_provider_select" ON public.service_requests;
CREATE POLICY "service_requests_provider_select" ON public.service_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = service_requests.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    OR public.provider_owns_match_assignment_for_request(service_requests.id)
  );

COMMENT ON FUNCTION public.provider_owns_match_assignment_for_request(uuid) IS
  'Sprint 4: non-recursive check that auth.uid() owns a match_assignment for the request.';
COMMENT ON POLICY "service_requests_provider_select" ON public.service_requests IS
  'Legacy RFQ provider_id OR match_assignment ownership via SECURITY DEFINER helper.';
