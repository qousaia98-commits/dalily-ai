-- Marketplace v2: providers must SELECT service_requests without provider_id.
-- Authority = match assignment OR unlock grant OR selection OR unlock session.
-- SECURITY DEFINER helpers avoid RLS recursion (same pattern as Sprint 4).

CREATE OR REPLACE FUNCTION public.provider_has_marketplace_access_to_request(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contact_release_grants g
    JOIN public.providers p ON p.id = g.provider_id
    WHERE g.service_request_id = p_request_id
      AND p.owner_id = auth.uid()
      AND p.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.marketplace_selections ms
    JOIN public.providers p ON p.id = ms.provider_id
    WHERE ms.service_request_id = p_request_id
      AND ms.status IN ('unlocked', 'pending_unlock')
      AND p.owner_id = auth.uid()
      AND p.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM public.unlock_sessions us
    JOIN public.providers p ON p.id = us.provider_id
    WHERE us.service_request_id = p_request_id
      AND us.status IN ('succeeded', 'opened', 'payment_pending')
      AND p.owner_id = auth.uid()
      AND p.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.provider_has_marketplace_access_to_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provider_has_marketplace_access_to_request(uuid) TO authenticated;

COMMENT ON FUNCTION public.provider_has_marketplace_access_to_request(uuid) IS
  'Marketplace v2: auth.uid() may access request via grant/selection/unlock session (no provider_id).';

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
    OR public.provider_has_marketplace_access_to_request(service_requests.id)
  );

COMMENT ON POLICY "service_requests_provider_select" ON public.service_requests IS
  'Legacy RFQ provider_id OR match assignment OR Marketplace v2 grant/selection/session.';

-- Selections: providers must read their own rows even when service_requests.provider_id is null.
DROP POLICY IF EXISTS marketplace_selections_select ON public.marketplace_selections;
CREATE POLICY marketplace_selections_select ON public.marketplace_selections
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = marketplace_selections.provider_id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = marketplace_selections.service_request_id
        AND (
          sr.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = sr.provider_id AND p.owner_id = auth.uid() AND p.deleted_at IS NULL
          )
          OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role IN ('admin', 'moderator')
              AND ur.revoked_at IS NULL
          )
        )
    )
  );

-- Reviews: allow assigned marketplace provider (grant) when service_requests.provider_id is null.
DROP POLICY IF EXISTS "service_reviews_customer_insert" ON public.service_reviews;
CREATE POLICY "service_reviews_customer_insert" ON public.service_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.service_requests sr
      WHERE sr.id = service_reviews.service_request_id
        AND sr.customer_id = auth.uid()
        AND sr.status = 'completed'
        AND (
          sr.provider_id = service_reviews.provider_id
          OR (
            sr.provider_id IS NULL
            AND COALESCE(sr.lifecycle_version, 1) >= 2
            AND EXISTS (
              SELECT 1 FROM public.contact_release_grants g
              WHERE g.service_request_id = sr.id
                AND g.provider_id = service_reviews.provider_id
            )
          )
        )
    )
  );

-- Realtime: grants so unlock success refreshes provider UIs without manual reload.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_release_grants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
