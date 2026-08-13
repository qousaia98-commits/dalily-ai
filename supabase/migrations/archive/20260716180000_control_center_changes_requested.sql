-- Sprint 18: Control Center — changes_requested status + review notes

ALTER TYPE public.provider_status ADD VALUE IF NOT EXISTS 'changes_requested';

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'provider_changes_requested';

ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS admin_review_note TEXT,
  ADD COLUMN IF NOT EXISTS changes_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN public.providers.admin_review_note IS
  'Latest admin note when requesting changes or rejecting a business.';
COMMENT ON COLUMN public.providers.changes_requested_at IS
  'When the admin last requested changes from the business.';
