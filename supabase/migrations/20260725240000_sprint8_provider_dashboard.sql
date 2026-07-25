-- Sprint 8 — Provider Dashboard (additive)
-- Align pause/emergency honesty with matching eligibility.
-- No drops; default preserves legacy matching behavior.

ALTER TABLE public.provider_request_settings
  ADD COLUMN IF NOT EXISTS handles_emergency boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.provider_request_settings.handles_emergency IS
  'Sprint 8: when false, provider is excluded from emergency urgency match pools. Pause still uses vacation_mode / accepting_requests.';
