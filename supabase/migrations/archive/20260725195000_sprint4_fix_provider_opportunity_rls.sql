-- Sprint 4 fix — assigned providers must read marketplace-native requests
-- Legacy provider_select required service_requests.provider_id = provider.id.
-- Dalily 2.0 v2 requests keep provider_id NULL until unlock; visibility is via match_assignments.

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
    OR EXISTS (
      SELECT 1
      FROM public.match_assignments ma
      JOIN public.providers p ON p.id = ma.provider_id
      WHERE ma.service_request_id = service_requests.id
        AND p.owner_id = auth.uid()
        AND p.deleted_at IS NULL
    )
  );

COMMENT ON POLICY "service_requests_provider_select" ON public.service_requests IS
  'Legacy RFQ (provider_id) OR Sprint 3/4 match_assignment visibility for marketplace-native requests.';
