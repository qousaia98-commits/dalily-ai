-- The flat $5/mo subscription model (Prompt 11) uses -1 as a sentinel for
-- "unlimited included leads" (see src/lib/monetization/visibility.ts,
-- INCLUDED_UNLOCKS_UNLIMITED), but the original baseline constraint only
-- allowed included_unlocks >= 0, so the admin settings form (and this
-- migration's own UPDATE below) could never actually persist "unlimited".

ALTER TABLE public.monetization_billing_settings
  DROP CONSTRAINT monetization_billing_settings_included_unlocks_check;

ALTER TABLE public.monetization_billing_settings
  ADD CONSTRAINT monetization_billing_settings_included_unlocks_check
  CHECK (included_unlocks >= -1);

-- Apply the flat-subscription defaults to the existing settings row
-- (it predates this pivot and was still holding the old $20/10 values).
UPDATE public.monetization_billing_settings
SET business_price_usd = 5,
    included_unlocks = -1,
    updated_at = now()
WHERE is_active = true;
