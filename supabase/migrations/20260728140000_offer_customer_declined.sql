-- Customer may decline a competing offer (trust-page flow).
-- Extends marketplace_offers.status without changing existing rows.

ALTER TABLE public.marketplace_offers
  DROP CONSTRAINT IF EXISTS marketplace_offers_status_check;

ALTER TABLE public.marketplace_offers
  ADD CONSTRAINT marketplace_offers_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'sent'::text,
        'withdrawn'::text,
        'selected'::text,
        'superseded'::text,
        'expired'::text,
        'declined'::text
      ]
    )
  );

COMMENT ON CONSTRAINT marketplace_offers_status_check ON public.marketplace_offers IS
  'Offer lifecycle including customer decline from public trust profile flow.';
