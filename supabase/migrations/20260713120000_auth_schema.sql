-- Dalily AI — Auth schema (PSD + Database Specification v1.0)
-- Scope: users, profiles, user_roles, providers + reference data for business signup

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE public.user_status AS ENUM ('active', 'suspended', 'banned');

CREATE TYPE public.app_role AS ENUM ('user', 'business', 'admin', 'moderator');

CREATE TYPE public.provider_status AS ENUM (
  'draft',
  'pending_review',
  'active',
  'suspended',
  'archived'
);

CREATE TYPE public.verification_status AS ENUM (
  'unverified',
  'pending',
  'partially_verified',
  'verified',
  'rejected',
  'expired'
);

-- =============================================================================
-- REFERENCE DATA (required for provider FK on business registration)
-- =============================================================================

CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) NOT NULL UNIQUE,
  name JSONB NOT NULL,
  description JSONB,
  icon VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT false,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name JSONB NOT NULL,
  country_code CHAR(2) NOT NULL DEFAULT 'SY',
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  population INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules (id) ON DELETE RESTRICT,
  parent_id UUID REFERENCES public.categories (id) ON DELETE SET NULL,
  slug VARCHAR(80) NOT NULL,
  name JSONB NOT NULL,
  description JSONB,
  icon VARCHAR(50),
  depth SMALLINT NOT NULL DEFAULT 0,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (module_id, slug)
);

-- =============================================================================
-- CORE AUTH TABLES
-- =============================================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20) UNIQUE,
  phone_verified_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  status public.user_status NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  preferred_locale VARCHAR(5) NOT NULL DEFAULT 'ar',
  preferred_city_id UUID REFERENCES public.cities (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_roles_active_unique
  ON public.user_roles (user_id, role)
  WHERE revoked_at IS NULL;

CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name JSONB NOT NULL,
  about JSONB,
  module_id UUID NOT NULL REFERENCES public.modules (id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
  city_id UUID NOT NULL REFERENCES public.cities (id) ON DELETE RESTRICT,
  district_id UUID,
  address_line JSONB,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(500),
  cover_image_id UUID,
  avatar_image_id UUID,
  status public.provider_status NOT NULL DEFAULT 'draft',
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  trust_score SMALLINT NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
  rating_avg DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
  review_count INTEGER NOT NULL DEFAULT 0,
  response_time_hours SMALLINT,
  profile_completeness SMALLINT NOT NULL DEFAULT 0 CHECK (profile_completeness BETWEEN 0 AND 100),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  featured_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users (id) ON DELETE SET NULL
);

CREATE INDEX providers_owner_id_idx ON public.providers (owner_id);
CREATE INDEX providers_status_idx ON public.providers (status) WHERE deleted_at IS NULL;
CREATE INDEX providers_city_category_idx ON public.providers (city_id, category_id, status);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- SEED: Services module, cities, categories
-- =============================================================================

INSERT INTO public.modules (id, slug, name, description, is_active, sort_order)
VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'services',
  '{"ar": "خدمات", "en": "Services"}',
  '{"ar": "مزودو الخدمات المحلية", "en": "Local service providers"}',
  true,
  0
);

INSERT INTO public.cities (id, slug, name, sort_order) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'damascus', '{"ar": "دمشق", "en": "Damascus"}', 1),
  ('b0000000-0000-4000-8000-000000000002', 'aleppo', '{"ar": "حلب", "en": "Aleppo"}', 2),
  ('b0000000-0000-4000-8000-000000000003', 'homs', '{"ar": "حمص", "en": "Homs"}', 3),
  ('b0000000-0000-4000-8000-000000000004', 'latakia', '{"ar": "اللاذقية", "en": "Latakia"}', 4);

INSERT INTO public.categories (id, module_id, slug, name, sort_order) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'plumber', '{"ar": "سبّاك", "en": "Plumber"}', 1),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'electrician', '{"ar": "كهربائي", "en": "Electrician"}', 2),
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'doctor', '{"ar": "طبيب", "en": "Doctor"}', 3),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'lawyer', '{"ar": "محامي", "en": "Lawyer"}', 4),
  ('c0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'mechanic', '{"ar": "ميكانيكي", "en": "Mechanic"}', 5),
  ('c0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'cleaner', '{"ar": "تنظيف", "en": "Cleaner"}', 6);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Public read for reference data
CREATE POLICY "modules_public_read" ON public.modules FOR SELECT USING (true);
CREATE POLICY "cities_public_read" ON public.cities FOR SELECT USING (true);
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (deleted_at IS NULL);

-- Users: own row only
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id AND deleted_at IS NULL);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id AND deleted_at IS NULL);

-- Profiles: own row + public read for display
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);

-- User roles: read own
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id AND revoked_at IS NULL);

CREATE POLICY "user_roles_insert_own" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Providers: owner full access on own; public reads active only
CREATE POLICY "providers_select_public_active" ON public.providers
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

CREATE POLICY "providers_select_own" ON public.providers
  FOR SELECT USING (auth.uid() = owner_id AND deleted_at IS NULL);

CREATE POLICY "providers_insert_own" ON public.providers
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "providers_update_own" ON public.providers
  FOR UPDATE USING (auth.uid() = owner_id AND deleted_at IS NULL);

-- =============================================================================
-- HELPER: Check role (for RLS extensions)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_role(check_role public.app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = check_role
      AND revoked_at IS NULL
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
