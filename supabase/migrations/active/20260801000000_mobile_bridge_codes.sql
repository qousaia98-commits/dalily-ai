-- One-time opaque codes for mobile WebView session bridge.
-- Stores short-lived session tokens server-side (never in URLs).
-- Access: service_role only (RLS on, no anon/authenticated policies).

CREATE TABLE public.mobile_bridge_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mobile_bridge_codes_code_unique UNIQUE (code)
);

CREATE INDEX mobile_bridge_codes_expires_at_idx
  ON public.mobile_bridge_codes (expires_at);

CREATE INDEX mobile_bridge_codes_user_id_idx
  ON public.mobile_bridge_codes (user_id);

ALTER TABLE public.mobile_bridge_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mobile_bridge_codes FROM anon;
REVOKE ALL ON TABLE public.mobile_bridge_codes FROM authenticated;

COMMENT ON TABLE public.mobile_bridge_codes IS
  'Opaque one-time codes for Expo WebView → web SSR session handoff. TTL ~60s. service_role only.';
