-- RC2.1 security: lock down unused payment_provider_event_types catalog table.
-- Confirmed unused in src/ (no application reads/writes). Archive seed only.
-- Choice: no client access (anon/authenticated) — table is reference-only and
-- unused; deny-by-default via RLS with no policies + revoke grants.
-- service_role retains ALL for ops/migrations.

ALTER TABLE public.payment_provider_event_types ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.payment_provider_event_types FROM anon;
REVOKE ALL ON TABLE public.payment_provider_event_types FROM authenticated;

-- Explicit: no SELECT/INSERT/UPDATE/DELETE policies for authenticated/anon.
-- Default RLS deny applies. service_role bypasses RLS in Supabase.

COMMENT ON TABLE public.payment_provider_event_types IS
  'Legacy payment event-type catalog (Sprint 6). Unused by app code; RLS enabled, no anon/authenticated access (RC2.1 hardening).';
