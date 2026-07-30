-- Sprint 10 Phase 3: Enterprise Communication extensions
-- Reactions, user blocks, conversation reports, moderation suspend flag.
-- Does not redesign chat core tables.

-- Message reactions (emoji), one per user per message per emoji
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reactions_emoji_len CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 16),
  CONSTRAINT message_reactions_unique UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS message_reactions_message_idx
  ON public.message_reactions (message_id);
CREATE INDEX IF NOT EXISTS message_reactions_conversation_idx
  ON public.message_reactions (conversation_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_reactions_select ON public.message_reactions
  FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY message_reactions_insert ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

CREATE POLICY message_reactions_delete ON public.message_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- User blocks (prevents new DMs / surfaces in safety layer)
CREATE TABLE IF NOT EXISTS public.chat_user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_user_blocks_self CHECK (blocker_id <> blocked_id),
  CONSTRAINT chat_user_blocks_unique UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS chat_user_blocks_blocker_idx
  ON public.chat_user_blocks (blocker_id);

ALTER TABLE public.chat_user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_user_blocks_own ON public.chat_user_blocks
  FOR ALL TO authenticated
  USING (blocker_id = auth.uid() OR public.has_role('admin'::public.app_role))
  WITH CHECK (blocker_id = auth.uid() OR public.has_role('admin'::public.app_role));

-- Conversation reports (moderation queue)
CREATE TABLE IF NOT EXISTS public.chat_conversation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status = ANY (ARRAY['open'::text, 'reviewing'::text, 'resolved'::text, 'dismissed'::text])),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_conversation_reports_reason_len CHECK (char_length(reason_code) BETWEEN 2 AND 64)
);

CREATE INDEX IF NOT EXISTS chat_conversation_reports_status_idx
  ON public.chat_conversation_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_conversation_reports_conversation_idx
  ON public.chat_conversation_reports (conversation_id);

ALTER TABLE public.chat_conversation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_reports_insert_own ON public.chat_conversation_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

CREATE POLICY chat_reports_select_own_or_admin ON public.chat_conversation_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.has_role('admin'::public.app_role)
  );

CREATE POLICY chat_reports_admin_update ON public.chat_conversation_reports
  FOR UPDATE TO authenticated
  USING (public.has_role('admin'::public.app_role))
  WITH CHECK (public.has_role('admin'::public.app_role));

-- Soft moderation flag on conversations (admin suspend)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active'
    CHECK (moderation_status = ANY (ARRAY['active'::text, 'suspended'::text, 'under_review'::text]));

COMMENT ON COLUMN public.conversations.moderation_status IS
  'Sprint 10 Phase 3: admin moderation state. suspended blocks new participant messages.';

COMMENT ON TABLE public.message_reactions IS
  'Sprint 10 Phase 3: emoji reactions on chat messages.';
COMMENT ON TABLE public.chat_user_blocks IS
  'Sprint 10 Phase 3: user-level messaging blocks.';
COMMENT ON TABLE public.chat_conversation_reports IS
  'Sprint 10 Phase 3: conversation abuse reports for admin queue.';

GRANT ALL ON TABLE public.message_reactions TO authenticated, service_role;
GRANT ALL ON TABLE public.chat_user_blocks TO authenticated, service_role;
GRANT ALL ON TABLE public.chat_conversation_reports TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ONLY public.message_reactions;
  END IF;
END $$;
