-- Sprint 34 — Reviews, Ratings & Trust System
-- Extends service_reviews; does not change search ranking engine.

-- ---------------------------------------------------------------------------
-- Review status / moderation / reply / anonymity / verification / helpful
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'hidden'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.service_reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status public.review_status NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified_booking BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified_customer BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verified_interaction BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0
    CHECK (helpful_count >= 0),
  ADD COLUMN IF NOT EXISTS provider_reply TEXT,
  ADD COLUMN IF NOT EXISTS provider_replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_reply_by UUID REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.service_reviews.status IS
  'Moderation status. Public lists only show approved + not soft-deleted.';
COMMENT ON COLUMN public.service_reviews.is_verified IS
  'True when review comes from a completed Dalily booking.';
COMMENT ON COLUMN public.service_reviews.helpful_count IS
  'Denormalized count of helpful votes — source of truth is service_review_helpful_votes.';

CREATE INDEX IF NOT EXISTS service_reviews_provider_public_idx
  ON public.service_reviews (provider_id, created_at DESC)
  WHERE deleted_at IS NULL AND status = 'approved';

CREATE INDEX IF NOT EXISTS service_reviews_provider_helpful_idx
  ON public.service_reviews (provider_id, helpful_count DESC)
  WHERE deleted_at IS NULL AND status = 'approved';

CREATE INDEX IF NOT EXISTS service_reviews_provider_rating_idx
  ON public.service_reviews (provider_id, rating DESC)
  WHERE deleted_at IS NULL AND status = 'approved';

-- ---------------------------------------------------------------------------
-- Helpful votes — one per user per review
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.service_review_helpful_votes (
  review_id UUID NOT NULL REFERENCES public.service_reviews (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS service_review_helpful_votes_user_idx
  ON public.service_review_helpful_votes (user_id);

ALTER TABLE public.service_review_helpful_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "review_helpful_select_own" ON public.service_review_helpful_votes;
CREATE POLICY "review_helpful_select_own"
  ON public.service_review_helpful_votes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "review_helpful_insert_own" ON public.service_review_helpful_votes;
CREATE POLICY "review_helpful_insert_own"
  ON public.service_review_helpful_votes FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.service_reviews r
      WHERE r.id = review_id
        AND r.deleted_at IS NULL
        AND r.status = 'approved'
        AND r.customer_id <> auth.uid()
    )
  );

DROP POLICY IF EXISTS "review_helpful_delete_own" ON public.service_review_helpful_votes;
CREATE POLICY "review_helpful_delete_own"
  ON public.service_review_helpful_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Keep helpful_count in sync
CREATE OR REPLACE FUNCTION public.sync_review_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.service_reviews
    SET helpful_count = helpful_count + 1, updated_at = now()
    WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.service_reviews
    SET helpful_count = GREATEST(0, helpful_count - 1), updated_at = now()
    WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_helpful_count ON public.service_review_helpful_votes;
CREATE TRIGGER trg_review_helpful_count
  AFTER INSERT OR DELETE ON public.service_review_helpful_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_review_helpful_count();

-- ---------------------------------------------------------------------------
-- Public read for approved reviews (profile / trust UI)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "service_reviews_select_public_approved" ON public.service_reviews;
CREATE POLICY "service_reviews_select_public_approved"
  ON public.service_reviews FOR SELECT TO anon, authenticated
  USING (deleted_at IS NULL AND status = 'approved');

DROP POLICY IF EXISTS "service_review_images_select_public_approved" ON public.service_review_images;
CREATE POLICY "service_review_images_select_public_approved"
  ON public.service_review_images FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_reviews r
      WHERE r.id = review_id
        AND r.deleted_at IS NULL
        AND r.status = 'approved'
    )
  );

-- Provider owner may reply once (update reply fields only via app; policy allows owner update)
DROP POLICY IF EXISTS "service_reviews_provider_reply" ON public.service_reviews;
CREATE POLICY "service_reviews_provider_reply"
  ON public.service_reviews FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid() AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = provider_id AND p.owner_id = auth.uid() AND p.deleted_at IS NULL
    )
  );

-- Admin/moderator soft-moderation
DROP POLICY IF EXISTS "service_reviews_admin_moderate" ON public.service_reviews;
CREATE POLICY "service_reviews_admin_moderate"
  ON public.service_reviews FOR UPDATE TO authenticated
  USING (public.has_role('admin') OR public.has_role('moderator'))
  WITH CHECK (public.has_role('admin') OR public.has_role('moderator'));

-- ---------------------------------------------------------------------------
-- Trust score recompute (NO subscription influence)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_provider_trust_score(p_provider_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC;
  v_count INTEGER;
  v_verified_count INTEGER;
  v_helpful INTEGER;
  v_verification TEXT;
  v_completed INTEGER;
  v_score NUMERIC := 0;
  v_final INTEGER;
BEGIN
  SELECT
    COALESCE(AVG(r.rating) FILTER (WHERE r.status = 'approved' AND r.deleted_at IS NULL), 0),
    COUNT(*) FILTER (WHERE r.status = 'approved' AND r.deleted_at IS NULL),
    COUNT(*) FILTER (WHERE r.status = 'approved' AND r.deleted_at IS NULL AND r.is_verified),
    COALESCE(SUM(r.helpful_count) FILTER (WHERE r.status = 'approved' AND r.deleted_at IS NULL), 0)
  INTO v_avg, v_count, v_verified_count, v_helpful
  FROM public.service_reviews r
  WHERE r.provider_id = p_provider_id;

  SELECT p.verification_status INTO v_verification
  FROM public.providers p WHERE p.id = p_provider_id;

  SELECT COUNT(*) INTO v_completed
  FROM public.service_requests sr
  WHERE sr.provider_id = p_provider_id
    AND sr.status IN ('completed', 'reviewed');

  -- Rating quality (0–40)
  v_score := v_score + LEAST(40, (v_avg / 5.0) * 40);
  -- Volume (0–20)
  v_score := v_score + LEAST(20, LN(1 + v_count) * 6.5);
  -- Verified share (0–15)
  IF v_count > 0 THEN
    v_score := v_score + (v_verified_count::NUMERIC / v_count) * 15;
  END IF;
  -- Helpful engagement (0–10)
  v_score := v_score + LEAST(10, LN(1 + v_helpful) * 3.5);
  -- Platform verification (0–10)
  IF v_verification = 'verified' THEN
    v_score := v_score + 10;
  ELSIF v_verification = 'partially_verified' THEN
    v_score := v_score + 5;
  END IF;
  -- Completed jobs (0–5)
  v_score := v_score + LEAST(5, LN(1 + v_completed) * 1.6);

  v_final := GREATEST(0, LEAST(100, ROUND(v_score)::INTEGER));

  UPDATE public.providers
  SET
    trust_score = v_final,
    rating_avg = CASE WHEN v_count > 0 THEN ROUND(v_avg::NUMERIC, 2) ELSE 0 END,
    review_count = v_count,
    updated_at = now()
  WHERE id = p_provider_id;

  RETURN v_final;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_provider_trust_score(UUID) TO authenticated, service_role;
