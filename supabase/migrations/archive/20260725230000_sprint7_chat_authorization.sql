-- Sprint 7 — Chat Authorization on Contact Release Grants (additive)
-- Full chat requires grant (or legacy status dual-run for lifecycle_version < 2).
-- Q&A remains offer_clarifications (not conversations).

-- Allow legacy backfill grants without an unlock session
ALTER TABLE public.contact_release_grants
  ALTER COLUMN unlock_session_id DROP NOT NULL;

ALTER TABLE public.contact_release_grants
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unlock';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contact_release_grants_source_check'
  ) THEN
    ALTER TABLE public.contact_release_grants
      ADD CONSTRAINT contact_release_grants_source_check
      CHECK (source IN ('unlock', 'legacy_backfill', 'admin'));
  END IF;
END $$;

COMMENT ON COLUMN public.contact_release_grants.source IS
  'unlock = Sprint 5/6 path; legacy_backfill = Sprint 7 soft-break for in-flight chats';

-- Conversation thread kind: legacy (status-era) vs full (grant-era)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS thread_kind text NOT NULL DEFAULT 'legacy';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_thread_kind_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_thread_kind_check
      CHECK (thread_kind IN ('legacy', 'full'));
  END IF;
END $$;

COMMENT ON COLUMN public.conversations.thread_kind IS
  'legacy = pre-grant status dual-run; full = grant-gated marketplace chat (Sprint 7)';

-- Grant check: chat in scope (jsonb array contains "chat")
CREATE OR REPLACE FUNCTION public.has_chat_release_grant(p_service_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contact_release_grants g
    WHERE g.service_request_id = p_service_request_id
      AND (
        g.scope ? 'chat'
        OR g.scope @> '"chat"'::jsonb
        OR g.scope @> '["chat"]'::jsonb
      )
  );
$$;

COMMENT ON FUNCTION public.has_chat_release_grant(uuid) IS
  'True when a contact_release_grants row authorizes full chat for the request.';

-- Message insert gate used by RLS (grant OR legacy status dual-run)
CREATE OR REPLACE FUNCTION public.conversation_allows_message_insert(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    LEFT JOIN public.service_requests sr ON sr.id = c.service_request_id
    WHERE c.id = p_conversation_id
      AND c.deleted_at IS NULL
      AND (
        c.service_request_id IS NULL
        OR public.has_chat_release_grant(c.service_request_id)
        OR (
          -- Dual-run: pre-marketplace-native RFQ chats keep status gate
          COALESCE(sr.lifecycle_version, 1) < 2
          AND sr.status IN (
            'accepted', 'quoted', 'quote_accepted', 'quote_declined',
            'in_progress', 'completed_by_business', 'completed'
          )
        )
      )
  );
$$;

COMMENT ON FUNCTION public.conversation_allows_message_insert(uuid) IS
  'RLS helper: grant for v2 / unlocked, or legacy status for lifecycle_version < 2.';

-- Replace insert policy: participant + grant/legacy gate (no bare status for v2)
DROP POLICY IF EXISTS messages_participant_insert ON public.messages;
CREATE POLICY messages_participant_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND public.conversation_allows_message_insert(conversation_id)
  );

-- Select: participants only (other providers already excluded). Keep soft-delete filter.
DROP POLICY IF EXISTS messages_participant_select ON public.messages;
CREATE POLICY messages_participant_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND (
      -- Allow read if grant/legacy insert would be allowed OR participant of legacy open thread
      public.conversation_allows_message_insert(conversation_id)
      OR EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id
          AND c.thread_kind = 'legacy'
          AND c.deleted_at IS NULL
      )
    )
  );

-- Soft-break backfill: in-flight legacy chats get a grant so they survive CHAT_AUTH_V2
INSERT INTO public.contact_release_grants (
  unlock_session_id,
  service_request_id,
  provider_id,
  customer_id,
  scope,
  granted_at,
  source
)
SELECT
  NULL,
  c.service_request_id,
  c.provider_id,
  c.customer_id,
  '["phone","whatsapp","address","chat"]'::jsonb,
  now(),
  'legacy_backfill'
FROM public.conversations c
JOIN public.service_requests sr ON sr.id = c.service_request_id
WHERE c.deleted_at IS NULL
  AND c.service_request_id IS NOT NULL
  AND sr.status IN (
    'accepted', 'quoted', 'quote_accepted', 'quote_declined',
    'in_progress', 'completed_by_business', 'completed', 'disputed'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.contact_release_grants g
    WHERE g.service_request_id = c.service_request_id
  )
ON CONFLICT (service_request_id) DO NOTHING;

-- Mark backfilled / grant-linked marketplace conversations as full when grant exists
UPDATE public.conversations c
SET thread_kind = 'full'
WHERE c.thread_kind = 'legacy'
  AND c.service_request_id IS NOT NULL
  AND public.has_chat_release_grant(c.service_request_id);
