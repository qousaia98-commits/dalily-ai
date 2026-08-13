-- Cham Cash (apisyria.com) auto-verification stores the provider's pasted
-- transaction id in payments.external_transaction_id. This index is the
-- source of truth preventing the same Cham Cash transaction from being
-- used to activate more than one subscription (app-level pre-check in
-- shamcash.provider.ts is a friendlier first line of defense, but a race
-- between two requests could otherwise slip past it).

CREATE UNIQUE INDEX IF NOT EXISTS payments_shamcash_external_tx_unique
  ON public.payments (external_transaction_id)
  WHERE payment_provider = 'shamcash' AND external_transaction_id IS NOT NULL;
