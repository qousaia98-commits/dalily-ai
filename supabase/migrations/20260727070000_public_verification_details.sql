-- Public verification catalog (data-driven levels + types) + provider checks
-- Privacy: public surfaces only read verified checks (no documents / IDs / notes)

CREATE TABLE IF NOT EXISTS public.verification_levels (
  slug TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  accent TEXT NOT NULL DEFAULT 'green'
    CHECK (accent IN ('green', 'blue', 'purple', 'gold', 'navy')),
  label_key TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.verification_types (
  slug TEXT PRIMARY KEY,
  level_slug TEXT NOT NULL REFERENCES public.verification_levels(slug) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  label_key TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verification_types_level_idx
  ON public.verification_types (level_slug, sort_order);

CREATE TABLE IF NOT EXISTS public.provider_verification_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  type_slug TEXT NOT NULL REFERENCES public.verification_types(slug) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  reviewed_by UUID,
  -- Internal only — never expose to customers
  internal_note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, type_slug)
);

CREATE INDEX IF NOT EXISTS provider_verification_checks_provider_idx
  ON public.provider_verification_checks (provider_id, status);

CREATE INDEX IF NOT EXISTS provider_verification_checks_public_idx
  ON public.provider_verification_checks (provider_id, verified_at DESC)
  WHERE status = 'verified';

-- Seed levels (catalog — UI reads from DB)
INSERT INTO public.verification_levels (slug, sort_order, accent, label_key, name_en, name_ar)
VALUES
  ('basic', 10, 'green', 'levels.basic', 'Basic Verified', 'تحقق أساسي'),
  ('business', 20, 'blue', 'levels.business', 'Business Verified', 'تحقق تجاري'),
  ('professional', 30, 'purple', 'levels.professional', 'Professional Verified', 'تحقق مهني')
ON CONFLICT (slug) DO NOTHING;

-- Seed types
INSERT INTO public.verification_types (slug, level_slug, sort_order, label_key, name_en, name_ar)
VALUES
  ('identity', 'basic', 10, 'types.identity', 'Identity Verified', 'الهوية موثّقة'),
  ('address', 'basic', 20, 'types.address', 'Address Verified', 'العنوان موثّق'),
  ('business_registration', 'business', 10, 'types.businessRegistration', 'Business Registration Verified', 'السجل التجاري موثّق'),
  ('trade_license', 'business', 20, 'types.tradeLicense', 'Trade License Verified', 'رخصة المزاولة موثّقة'),
  ('insurance', 'professional', 10, 'types.insurance', 'Insurance Verified', 'التأمين موثّق'),
  ('professional_certificate', 'professional', 20, 'types.professionalCertificate', 'Professional Certificate Verified', 'الشهادة المهنية موثّقة'),
  ('master_craftsman_certificate', 'professional', 30, 'types.masterCraftsman', 'Master Craftsman Certificate Verified', 'شهادة المعلم الحرفي موثّقة')
ON CONFLICT (slug) DO NOTHING;

-- Backfill identity checks from existing approved provider_verifications
INSERT INTO public.provider_verification_checks (
  provider_id, type_slug, status, verified_at, reviewed_by, updated_at
)
SELECT
  pv.provider_id,
  'identity',
  'verified',
  COALESCE(pv.reviewed_at, pv.updated_at, now()),
  pv.reviewed_by,
  now()
FROM public.provider_verifications pv
WHERE pv.status = 'approved'
ON CONFLICT (provider_id, type_slug) DO UPDATE
  SET status = 'verified',
      verified_at = COALESCE(public.provider_verification_checks.verified_at, EXCLUDED.verified_at),
      updated_at = now();

-- Also backfill from providers.verification_status = verified (legacy)
INSERT INTO public.provider_verification_checks (
  provider_id, type_slug, status, verified_at, updated_at
)
SELECT
  p.id,
  'identity',
  'verified',
  COALESCE(p.published_at, p.updated_at, now()),
  now()
FROM public.providers p
WHERE p.verification_status = 'verified'
  AND p.deleted_at IS NULL
ON CONFLICT (provider_id, type_slug) DO NOTHING;

ALTER TABLE public.verification_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_verification_checks ENABLE ROW LEVEL SECURITY;

-- Catalog readable by authenticated (and anon via service role for public pages)
DROP POLICY IF EXISTS verification_levels_read ON public.verification_levels;
CREATE POLICY verification_levels_read ON public.verification_levels
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS verification_types_read ON public.verification_types;
CREATE POLICY verification_types_read ON public.verification_types
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Providers can see own checks; admins all; customers never via RLS (use server admin client for public summary)
DROP POLICY IF EXISTS provider_verification_checks_own ON public.provider_verification_checks;
CREATE POLICY provider_verification_checks_own ON public.provider_verification_checks
  FOR SELECT TO authenticated
  USING (
    public.has_role('admin')
    OR EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS provider_verification_checks_admin_write ON public.provider_verification_checks;
CREATE POLICY provider_verification_checks_admin_write ON public.provider_verification_checks
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

COMMENT ON TABLE public.verification_levels IS
  'Public verification levels catalog (basic/business/professional). Extensible.';
COMMENT ON TABLE public.verification_types IS
  'Public verification type catalog. New rows appear in the public panel automatically.';
COMMENT ON TABLE public.provider_verification_checks IS
  'Per-provider verification outcomes. Public UI only exposes verified rows (no docs/PII).';
