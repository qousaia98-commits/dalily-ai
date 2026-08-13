-- Sprint 7 Phase 2 — Ratings, Reviews & AI Reputation
-- Additive on service_reviews (provider_reviews VIEW alias).

ALTER TABLE public.service_reviews
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS editable_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delete_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delete_request_reason TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS sentiment TEXT
    CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'mixed'));

CREATE INDEX IF NOT EXISTS service_reviews_booking_uidx
  ON public.service_reviews (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE OR REPLACE VIEW public.provider_reviews AS
SELECT * FROM public.service_reviews;

COMMENT ON VIEW public.provider_reviews IS
  'Sprint 7 Phase 2 — alias of service_reviews for reputation domain naming.';

CREATE TABLE IF NOT EXISTS public.review_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.service_reviews(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL
    CHECK (dimension IN (
      'overall', 'communication', 'quality', 'punctuality',
      'professionalism', 'value'
    )),
  score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, dimension)
);

CREATE INDEX IF NOT EXISTS review_ratings_review_idx
  ON public.review_ratings (review_id);

ALTER TABLE public.service_review_images
  ADD COLUMN IF NOT EXISTS media_kind TEXT
    CHECK (media_kind IS NULL OR media_kind IN (
      'before', 'after', 'completed', 'general', 'video'
    ));

UPDATE public.service_review_images
SET media_kind = COALESCE(media_kind, 'completed')
WHERE media_kind IS NULL;

CREATE TABLE IF NOT EXISTS public.review_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.service_reviews(id) ON DELETE CASCADE,
  media_kind TEXT NOT NULL DEFAULT 'completed'
    CHECK (media_kind IN ('before', 'after', 'completed', 'general', 'video')),
  bucket TEXT NOT NULL DEFAULT 'service-request-media',
  path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);

CREATE INDEX IF NOT EXISTS review_media_review_idx
  ON public.review_media (review_id, sort_order);

INSERT INTO public.review_media (review_id, media_kind, bucket, path, mime_type, size_bytes, sort_order)
SELECT
  review_id,
  COALESCE(media_kind, 'completed'),
  bucket,
  path,
  mime_type,
  size_bytes,
  sort_order
FROM public.service_review_images
ON CONFLICT (bucket, path) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL UNIQUE REFERENCES public.service_reviews(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ,
  pinned_by_admin BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO public.review_responses (review_id, provider_id, body, created_by, created_at)
SELECT
  r.id,
  r.provider_id,
  r.provider_reply,
  r.provider_reply_by,
  COALESCE(r.provider_replied_at, r.updated_at, r.created_at)
FROM public.service_reviews r
WHERE r.provider_reply IS NOT NULL
ON CONFLICT (review_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.review_ai_analysis (
  review_id UUID PRIMARY KEY REFERENCES public.service_reviews(id) ON DELETE CASCADE,
  short_summary TEXT,
  sentiment TEXT
    CHECK (sentiment IS NULL OR sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  positive_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvement_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  language_detected TEXT,
  translation_ready BOOLEAN NOT NULL DEFAULT false,
  fake_risk_score NUMERIC(5,4) NOT NULL DEFAULT 0,
  fake_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_version TEXT NOT NULL DEFAULT 'heuristic-v1',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.review_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.service_reviews(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL
    CHECK (flag_type IN (
      'spam', 'repeated', 'copied', 'offensive', 'mass', 'bot',
      'booking_conflict', 'fake_suspected', 'other'
    )),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high')),
  source TEXT NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'user', 'admin', 'system')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_flags_open_idx
  ON public.review_flags (review_id, created_at DESC)
  WHERE resolved_at IS NULL;

CREATE TABLE IF NOT EXISTS public.review_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.service_reviews(id) ON DELETE CASCADE,
  action TEXT NOT NULL
    CHECK (action IN (
      'hide', 'restore', 'delete', 'approve', 'reject',
      'flag_reviewed', 'merge', 'media_moderate', 'delete_request'
    )),
  actor_id UUID,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS review_moderation_review_idx
  ON public.review_moderation (review_id, created_at DESC);

CREATE OR REPLACE VIEW public.review_helpfulness AS
SELECT review_id, user_id, created_at
FROM public.service_review_helpful_votes;

CREATE TABLE IF NOT EXISTS public.provider_reputation_cache (
  provider_id UUID PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  recommendation_rate NUMERIC(5,2),
  ai_summary_en TEXT,
  ai_summary_ar TEXT,
  quality_label TEXT,
  response_rate NUMERIC(5,2),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.review_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  edit_window_days INTEGER NOT NULL DEFAULT 14,
  block_on_high_fake_risk BOOLEAN NOT NULL DEFAULT true,
  fake_risk_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.72,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.review_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.review_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_ai_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reputation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS review_ratings_public_read ON public.review_ratings;
CREATE POLICY review_ratings_public_read ON public.review_ratings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_reviews r
      WHERE r.id = review_id AND r.status = 'approved' AND r.deleted_at IS NULL
    )
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS review_media_public_read ON public.review_media;
CREATE POLICY review_media_public_read ON public.review_media
  FOR SELECT TO authenticated
  USING (
    (
      moderation_status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.service_reviews r
        WHERE r.id = review_id AND r.status = 'approved' AND r.deleted_at IS NULL
      )
    )
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS review_responses_public_read ON public.review_responses;
CREATE POLICY review_responses_public_read ON public.review_responses
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_reviews r
      WHERE r.id = review_id AND r.status = 'approved' AND r.deleted_at IS NULL
    )
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS review_ai_public_read ON public.review_ai_analysis;
CREATE POLICY review_ai_public_read ON public.review_ai_analysis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_reviews r
      WHERE r.id = review_id AND r.status = 'approved' AND r.deleted_at IS NULL
    )
    OR public.has_role('admin')
  );

DROP POLICY IF EXISTS review_flags_admin ON public.review_flags;
CREATE POLICY review_flags_admin ON public.review_flags
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS review_moderation_admin ON public.review_moderation;
CREATE POLICY review_moderation_admin ON public.review_moderation
  FOR ALL TO authenticated
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

DROP POLICY IF EXISTS provider_reputation_read ON public.provider_reputation_cache;
CREATE POLICY provider_reputation_read ON public.provider_reputation_cache
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS review_settings_read ON public.review_settings;
CREATE POLICY review_settings_read ON public.review_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.recompute_provider_trust_score(p_provider_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC;
  v_count INTEGER;
  v_verified INTEGER;
  v_helpful INTEGER;
  v_completed INTEGER;
  v_verification TEXT;
  v_recommend_yes INTEGER;
  v_recommend_total INTEGER;
  v_with_reply INTEGER;
  v_recent_avg NUMERIC;
  v_score NUMERIC := 0;
  v_final INTEGER;
BEGIN
  SELECT
    COALESCE(AVG(rating), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE is_verified),
    COALESCE(SUM(helpful_count), 0),
    COUNT(*) FILTER (WHERE recommend IS TRUE),
    COUNT(*) FILTER (WHERE recommend IS NOT NULL),
    COUNT(*) FILTER (WHERE provider_reply IS NOT NULL),
    COALESCE(
      AVG(rating) FILTER (WHERE created_at > now() - INTERVAL '180 days'),
      AVG(rating),
      0
    )
  INTO v_avg, v_count, v_verified, v_helpful, v_recommend_yes, v_recommend_total, v_with_reply, v_recent_avg
  FROM public.service_reviews
  WHERE provider_id = p_provider_id
    AND deleted_at IS NULL
    AND status = 'approved';

  SELECT verification_status INTO v_verification
  FROM public.providers WHERE id = p_provider_id;

  SELECT COUNT(*) INTO v_completed
  FROM public.service_requests
  WHERE provider_id = p_provider_id
    AND status IN ('completed', 'reviewed');

  v_score := v_score + LEAST(40, (((v_avg * 0.4) + (v_recent_avg * 0.6)) / 5.0) * 40);
  v_score := v_score + LEAST(18, LN(1 + v_count) * 6.0);
  IF v_count > 0 THEN
    v_score := v_score + (v_verified::NUMERIC / v_count) * 12;
    IF v_recommend_total > 0 THEN
      v_score := v_score + (v_recommend_yes::NUMERIC / v_recommend_total) * 8;
    END IF;
    v_score := v_score + LEAST(6, (v_with_reply::NUMERIC / v_count) * 6);
  END IF;
  v_score := v_score + LEAST(8, LN(1 + v_helpful) * 3.0);

  IF v_verification = 'verified' THEN v_score := v_score + 10;
  ELSIF v_verification = 'partially_verified' THEN v_score := v_score + 5;
  END IF;

  v_score := v_score + LEAST(5, LN(1 + v_completed) * 1.6);
  v_final := GREATEST(0, LEAST(100, ROUND(v_score)::INTEGER));

  UPDATE public.providers
  SET
    trust_score = v_final,
    rating_avg = ROUND(COALESCE(v_avg, 0)::NUMERIC, 2),
    review_count = COALESCE(v_count, 0),
    updated_at = now()
  WHERE id = p_provider_id;

  INSERT INTO public.provider_reputation_cache (
    provider_id, recommendation_rate, response_rate, quality_label, computed_at, payload
  ) VALUES (
    p_provider_id,
    CASE WHEN v_recommend_total > 0
      THEN ROUND((v_recommend_yes::NUMERIC / v_recommend_total) * 100, 2)
      ELSE NULL END,
    CASE WHEN v_count > 0
      THEN ROUND((v_with_reply::NUMERIC / v_count) * 100, 2)
      ELSE NULL END,
    CASE
      WHEN COALESCE(v_avg, 0) >= 4.7 THEN 'Excellent'
      WHEN COALESCE(v_avg, 0) >= 4.2 THEN 'Very good'
      WHEN COALESCE(v_avg, 0) >= 3.5 THEN 'Good'
      WHEN COALESCE(v_avg, 0) >= 2.5 THEN 'Fair'
      WHEN v_count = 0 THEN NULL
      ELSE 'Needs improvement'
    END,
    now(),
    jsonb_build_object(
      'ratingAvg', COALESCE(v_avg, 0),
      'recentAvg', COALESCE(v_recent_avg, 0),
      'reviewCount', COALESCE(v_count, 0)
    )
  )
  ON CONFLICT (provider_id) DO UPDATE SET
    recommendation_rate = EXCLUDED.recommendation_rate,
    response_rate = EXCLUDED.response_rate,
    quality_label = EXCLUDED.quality_label,
    computed_at = EXCLUDED.computed_at,
    payload = EXCLUDED.payload;

  RETURN v_final;
END;
$$;

GRANT SELECT ON public.provider_reviews TO authenticated;
GRANT SELECT ON public.review_helpfulness TO authenticated;
