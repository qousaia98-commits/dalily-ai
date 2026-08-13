-- Direct-search assignments: allow source = 'direct_search'
-- (customer chose a specific provider via /find → request/new?providerId=)

ALTER TABLE public.match_assignments
  DROP CONSTRAINT IF EXISTS match_assignments_source_check;

ALTER TABLE public.match_assignments
  ADD CONSTRAINT match_assignments_source_check
  CHECK (
    source = ANY (
      ARRAY[
        'initial'::text,
        'expand'::text,
        'newcomer'::text,
        'direct_search'::text
      ]
    )
  );
