-- Sprint 36 — Real-Time Chat & Messaging Platform
-- Extends existing conversations/messages (1:1 per service request).
-- Does not alter Search / Diagnosis / Vision / Smart Map / Reviews.

-- =============================================================================
-- CONVERSATIONS — status, pin, archive, soft delete
-- =============================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'archived')),
  ADD COLUMN IF NOT EXISTS pinned_by_customer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_by_provider BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_by_customer BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_by_provider BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS conversations_customer_activity_idx
  ON public.conversations (customer_id, last_message_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS conversations_provider_activity_idx
  ON public.conversations (provider_id, last_message_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

-- =============================================================================
-- PARTICIPANTS — future-ready for group chats (synced from 1:1 rows)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('customer', 'provider', 'member', 'admin')),
  last_read_at TIMESTAMPTZ,
  last_delivered_at TIMESTAMPTZ,
  muted BOOLEAN NOT NULL DEFAULT false,
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_participants_user_idx
  ON public.conversation_participants (user_id)
  WHERE deleted_at IS NULL;

-- Backfill participants from existing 1:1 conversations
INSERT INTO public.conversation_participants (conversation_id, user_id, role)
SELECT c.id, c.customer_id, 'customer'
FROM public.conversations c
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO public.conversation_participants (conversation_id, user_id, role)
SELECT c.id, p.owner_id, 'provider'
FROM public.conversations c
JOIN public.providers p ON p.id = c.provider_id
WHERE p.owner_id IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- Keep participants in sync when a conversation is created
CREATE OR REPLACE FUNCTION public.sync_conversation_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
BEGIN
  INSERT INTO public.conversation_participants (conversation_id, user_id, role)
  VALUES (NEW.id, NEW.customer_id, 'customer')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  SELECT owner_id INTO v_owner FROM public.providers WHERE id = NEW.provider_id;
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (NEW.id, v_owner, 'provider')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_conversation_participants ON public.conversations;
CREATE TRIGGER trg_sync_conversation_participants
  AFTER INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.sync_conversation_participants();

-- =============================================================================
-- MESSAGES — types, delivery, edit, soft delete
-- =============================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'document', 'location', 'voice', 'system', 'video')),
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'delivered', 'read')),
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS location_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_label TEXT;

-- Allow attachment-only / location messages (empty body)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_body_not_empty;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_body_or_rich_content
  CHECK (
    length(trim(coalesce(body_text, ''))) > 0
    OR message_type IN ('image', 'document', 'location', 'voice', 'video', 'system')
    OR deleted_at IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS messages_body_fts_idx
  ON public.messages
  USING gin (to_tsvector('simple', coalesce(body_text, '')))
  WHERE deleted_at IS NULL AND coalesce(body_text, '') <> '';

-- =============================================================================
-- ATTACHMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL DEFAULT 'chat-attachments',
  path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  width INT,
  height INT,
  kind TEXT NOT NULL DEFAULT 'document'
    CHECK (kind IN ('image', 'document', 'voice', 'video', 'other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS message_attachments_message_idx
  ON public.message_attachments (message_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS message_attachments_conversation_idx
  ON public.message_attachments (conversation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS message_attachments_name_fts_idx
  ON public.message_attachments
  USING gin (to_tsvector('simple', coalesce(file_name, '')))
  WHERE deleted_at IS NULL;

-- =============================================================================
-- READ RECEIPTS (per message, future multi-participant)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'delivered'
    CHECK (status IN ('delivered', 'read')),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_read_receipts_user_idx
  ON public.message_read_receipts (user_id, read_at DESC NULLS LAST);

-- =============================================================================
-- TYPING STATUS (ephemeral DB row; Realtime Broadcast preferred for UX)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_typing (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '6 seconds'),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_typing_expires_idx
  ON public.conversation_typing (expires_at);

-- =============================================================================
-- PRESENCE (last seen only — no private location)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'offline')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- CHAT ANALYTICS (no message content)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.chat_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'conversation_created',
      'message_sent',
      'message_read',
      'attachment_sent',
      'conversation_closed',
      'first_response'
    )),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  actor_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_analytics_events_type_idx
  ON public.chat_analytics_events (event_type, created_at DESC);

-- =============================================================================
-- HELPERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    LEFT JOIN public.providers pr ON pr.id = c.provider_id
    WHERE c.id = p_conversation_id
      AND c.deleted_at IS NULL
      AND (
        c.customer_id = p_user_id
        OR pr.owner_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = p_user_id
            AND cp.deleted_at IS NULL
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.mark_messages_delivered(p_conversation_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id, p_user_id) THEN
    RETURN;
  END IF;

  UPDATE public.messages m
  SET delivery_status = CASE
    WHEN m.delivery_status = 'sent' THEN 'delivered'
    ELSE m.delivery_status
  END
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
    AND m.delivery_status = 'sent';

  INSERT INTO public.message_read_receipts (message_id, user_id, status, delivered_at)
  SELECT m.id, p_user_id, 'delivered', now()
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
  ON CONFLICT (message_id, user_id) DO UPDATE
    SET delivered_at = coalesce(message_read_receipts.delivered_at, excluded.delivered_at),
        status = CASE
          WHEN message_read_receipts.status = 'read' THEN 'read'
          ELSE 'delivered'
        END;

  UPDATE public.conversation_participants
  SET last_delivered_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id, p_user_id) THEN
    RETURN;
  END IF;

  PERFORM public.mark_messages_delivered(p_conversation_id, p_user_id);

  UPDATE public.messages m
  SET delivery_status = 'read'
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
    AND m.delivery_status <> 'read';

  INSERT INTO public.message_read_receipts (message_id, user_id, status, delivered_at, read_at)
  SELECT m.id, p_user_id, 'read', coalesce(r.delivered_at, now()), now()
  FROM public.messages m
  LEFT JOIN public.message_read_receipts r
    ON r.message_id = m.id AND r.user_id = p_user_id
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> p_user_id
    AND m.deleted_at IS NULL
  ON CONFLICT (message_id, user_id) DO UPDATE
    SET status = 'read',
        read_at = now(),
        delivered_at = coalesce(message_read_receipts.delivered_at, excluded.delivered_at);

  UPDATE public.conversation_participants
  SET last_read_at = now(), last_delivered_at = coalesce(last_delivered_at, now())
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_user_presence(p_user_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_presence (user_id, status, last_seen_at, updated_at)
  VALUES (p_user_id, p_status, now(), now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = excluded.status,
        last_seen_at = CASE
          WHEN excluded.status = 'offline' THEN now()
          ELSE user_presence.last_seen_at
        END,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_conversation_typing(p_conversation_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_conversation_participant(p_conversation_id, p_user_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.conversation_typing (conversation_id, user_id, started_at, expires_at)
  VALUES (p_conversation_id, p_user_id, now(), now() + interval '6 seconds')
  ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET started_at = now(),
        expires_at = now() + interval '6 seconds';
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_conversation_typing(p_conversation_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.conversation_typing
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_typing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_participants_select ON public.conversation_participants;
CREATE POLICY conversation_participants_select ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS conversation_participants_update_self ON public.conversation_participants;
CREATE POLICY conversation_participants_update_self ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS message_attachments_select ON public.message_attachments;
CREATE POLICY message_attachments_select ON public.message_attachments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS message_attachments_insert ON public.message_attachments;
CREATE POLICY message_attachments_insert ON public.message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS message_read_receipts_select ON public.message_read_receipts;
CREATE POLICY message_read_receipts_select ON public.message_read_receipts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND public.is_conversation_participant(m.conversation_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS conversation_typing_select ON public.conversation_typing;
CREATE POLICY conversation_typing_select ON public.conversation_typing
  FOR SELECT TO authenticated
  USING (
    expires_at > now()
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS user_presence_select ON public.user_presence;
CREATE POLICY user_presence_select ON public.user_presence
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp1
      JOIN public.conversation_participants cp2
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid()
        AND cp2.user_id = user_presence.user_id
        AND cp1.deleted_at IS NULL
        AND cp2.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS chat_analytics_deny_select ON public.chat_analytics_events;
CREATE POLICY chat_analytics_deny_select ON public.chat_analytics_events
  FOR SELECT TO authenticated
  USING (public.has_role('admin'));

-- Soft-delete aware conversation select (keep existing + tighten)
DROP POLICY IF EXISTS conversations_participant_select ON public.conversations;
CREATE POLICY conversations_participant_select ON public.conversations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_conversation_participant(id, auth.uid())
  );

DROP POLICY IF EXISTS conversations_participant_update ON public.conversations;
CREATE POLICY conversations_participant_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()))
  WITH CHECK (public.is_conversation_participant(id, auth.uid()));

DROP POLICY IF EXISTS messages_participant_select ON public.messages;
CREATE POLICY messages_participant_select ON public.messages
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS messages_participant_insert ON public.messages;
CREATE POLICY messages_participant_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      LEFT JOIN public.service_requests sr ON sr.id = c.service_request_id
      WHERE c.id = conversation_id
        AND c.deleted_at IS NULL
        AND (
          c.service_request_id IS NULL
          OR sr.status IN (
            'accepted', 'quoted', 'quote_accepted', 'quote_declined',
            'in_progress', 'completed_by_business', 'completed'
          )
        )
    )
  );

DROP POLICY IF EXISTS messages_sender_update ON public.messages;
CREATE POLICY messages_sender_update ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.is_conversation_participant(conversation_id, auth.uid())
  )
  WITH CHECK (
    public.is_conversation_participant(conversation_id, auth.uid())
  );

-- =============================================================================
-- STORAGE — chat-attachments (private, signed URLs)
-- Path: {userId}/{conversationId}/{filename}
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS chat_attachments_insert ON storage.objects;
CREATE POLICY chat_attachments_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS chat_attachments_select ON storage.objects;
CREATE POLICY chat_attachments_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role('admin')
      OR public.has_role('moderator')
      OR (
        array_length(storage.foldername(name), 1) >= 2
        AND public.is_conversation_participant(
          ((storage.foldername(name))[2])::uuid,
          auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS chat_attachments_delete ON storage.objects;
CREATE POLICY chat_attachments_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- REALTIME PUBLICATION
-- =============================================================================

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_attachments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_read_receipts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_typing;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
