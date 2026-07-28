-- Sprint 5 Phase 1 — Real-Time Chat enhancements
-- Builds on Sprint 36 chat platform + Phase 4 project/package scopes.

ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_type_chk;

ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_type_chk CHECK (
    event_type IN (
      'provider_viewed',
      'provider_clicked',
      'request_started',
      'request_sent',
      'request_accepted',
      'request_declined',
      'provider_no_response',
      'request_completed',
      'customer_cancelled',
      'provider_cancelled',
      'review_submitted',
      'repeat_booking',
      'recommendation_shown',
      'recommendation_chosen',
      'diagnosis_completed',
      'diagnosis_abandoned',
      'intent_suggested',
      'intent_confirmed',
      'intent_corrected',
      'category_changed',
      'knowledge_hit',
      'knowledge_miss',
      'llm_invoked',
      'provider_accepted',
      'provider_declined',
      'job_completed',
      'memory_recorded',
      'urgency_corrected',
      'workflow_recommended',
      'workflow_overridden',
      'match_ranked',
      'match_accepted',
      'match_rejected',
      'question_answered',
      'intent_cached',
      'dispatch_planned',
      'dispatch_exposed',
      'capacity_skipped',
      'route_boosted',
      'response_predicted',
      'eta_predicted',
      'prediction_compared',
      'reputation_updated',
      'job_analyzed',
      'job_prep_shown',
      'job_duration_compared',
      'job_materials_compared',
      'job_complexity_compared',
      'multi_service_detected',
      'vision_analyzed',
      'vision_cached',
      'vision_confirmed',
      'vision_corrected',
      'vision_fused',
      'vision_contradiction',
      'vision_damage_compared',
      'vision_tools_compared',
      'vision_materials_compared',
      'voice_transcribed',
      'voice_cached',
      'voice_confirmed',
      'voice_corrected',
      'voice_transcript_edited',
      'voice_fused',
      'voice_contradiction',
      'voice_language_detected',
      'voice_stt_failed',
      'voice_category_compared',
      'assistant_shown',
      'assistant_suggestion_accepted',
      'assistant_suggestion_ignored',
      'assistant_suggestion_rejected',
      'assistant_summary_generated',
      'assistant_summary_rated',
      'assistant_offer_compared',
      'assistant_appointment_briefed',
      'assistant_after_job',
      'assistant_reminder_sent',
      'assistant_reminder_acted',
      'assistant_context_updated',
      'forecast_correct',
      'forecast_incorrect',
      'capacity_prediction',
      'demand_prediction',
      'wait_time_prediction',
      'notification_clicked',
      'recommendation_followed',
      'balance_action_recommended',
      'prediction_calibrated',
      'automation_suggested',
      'automation_executed',
      'automation_confirmed',
      'automation_rejected',
      'automation_modified',
      'automation_reversed',
      'automation_blocked_safety',
      'workflow_run',
      'marketplace_mode_chosen',
      'ai_path_recommendation_accepted',
      'ai_path_recommendation_ignored',
      'provider_contacted_directly',
      'request_published',
      'dual_path_switched',
      'slot_suggested',
      'slot_suggestion_accepted',
      'slot_suggestion_rejected',
      'appointment_cancelled',
      'appointment_delayed',
      'appointment_duration_compared',
      'appointment_arrival_compared',
      'day_schedule_optimized',
      'reschedule_suggested',
      'reschedule_accepted',
      'reschedule_rejected',
      'booking_reminder_sent',
      'emergency_detected',
      'emergency_dispatch_started',
      'emergency_provider_notified',
      'emergency_accepted',
      'emergency_declined',
      'emergency_busy',
      'emergency_on_the_way',
      'emergency_arrived',
      'emergency_work_started',
      'emergency_completed',
      'emergency_dispatch_stopped',
      'live_eta_updated',
      'live_location_shared',
      'live_location_disabled',
      'project_detected',
      'project_created',
      'project_plan_generated',
      'project_plan_reordered',
      'project_package_matched',
      'project_package_booked',
      'project_package_started',
      'project_package_completed',
      'project_dependency_blocked',
      'project_delay_detected',
      'project_schedule_adjusted',
      'project_completed',
      'project_duration_compared',
      'recurring_plan_created',
      'recurring_plan_renewed',
      'recurring_plan_paused',
      'recurring_plan_resumed',
      'recurring_plan_cancelled',
      'recurring_visit_skipped',
      'recurring_visit_rescheduled',
      'recurring_visit_completed',
      'recurring_visit_generated',
      'recurring_recommendation_shown',
      'recurring_recommendation_accepted',
      'recurring_recommendation_rejected',
      'recurring_reminder_sent',
      'recurring_route_optimized',
      'maintenance_due_detected',
      -- Sprint 5 Phase 1
      'chat_message_sent',
      'chat_message_edited',
      'chat_message_deleted',
      'chat_reply_sent',
      'chat_message_pinned',
      'chat_message_unpinned',
      'chat_read',
      'chat_mark_all_read',
      'chat_search',
      'chat_typing',
      'chat_presence',
      'chat_reply_latency',
      'chat_read_latency',
      'chat_conversation_opened',
      'chat_emergency_response'
    )
  );

-- Expand conversation scopes
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_chat_scope_check;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS admin_user_id UUID,
  ADD COLUMN IF NOT EXISTS emergency_dispatch_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_chat_scope_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_chat_scope_check
      CHECK (chat_scope IN (
        'request',
        'project',
        'package',
        'emergency',
        'admin',
        'support'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS conversations_admin_user_idx
  ON public.conversations (admin_user_id)
  WHERE admin_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversations_scope_idx
  ON public.conversations (chat_scope, last_message_at DESC);

-- Message features: reply, pin, forward-ready metadata
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by UUID,
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_reply_to_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_reply_to_fkey
      FOREIGN KEY (reply_to_message_id)
      REFERENCES public.messages (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS messages_reply_to_idx
  ON public.messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_pinned_idx
  ON public.messages (conversation_id, pinned_at DESC)
  WHERE is_pinned = true;

-- Enable pg_trgm if missing (for search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS messages_body_trgm_idx
  ON public.messages USING gin (body_text gin_trgm_ops);

-- Participant-scoped message search
CREATE OR REPLACE FUNCTION public.search_chat_messages(
  p_user_id UUID,
  p_query TEXT,
  p_conversation_id UUID DEFAULT NULL,
  p_sender_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 40
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  sender_id UUID,
  body_text TEXT,
  created_at TIMESTAMPTZ,
  message_type TEXT,
  delivery_status TEXT,
  edited_at TIMESTAMPTZ,
  reply_to_message_id UUID,
  is_pinned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    m.body_text,
    m.created_at,
    m.message_type::text,
    COALESCE(m.delivery_status::text, 'sent'),
    m.edited_at,
    m.reply_to_message_id,
    COALESCE(m.is_pinned, false)
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  LEFT JOIN public.providers pr ON pr.id = c.provider_id
  WHERE m.deleted_at IS NULL
    AND c.deleted_at IS NULL
    AND (
      c.customer_id = p_user_id
      OR pr.owner_id = p_user_id
      OR c.admin_user_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM public.conversation_participants cp
        WHERE cp.conversation_id = c.id AND cp.user_id = p_user_id
      )
    )
    AND (p_conversation_id IS NULL OR m.conversation_id = p_conversation_id)
    AND (p_sender_id IS NULL OR m.sender_id = p_sender_id)
    AND (p_from IS NULL OR m.created_at >= p_from)
    AND (p_to IS NULL OR m.created_at <= p_to)
    AND m.body_text ILIKE ('%' || p_query || '%')
  ORDER BY m.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
END;
$$;

REVOKE ALL ON FUNCTION public.search_chat_messages FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_chat_messages TO authenticated, service_role;

-- Mark all conversations read for a viewer
CREATE OR REPLACE FUNCTION public.mark_all_conversations_read(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INT := 0;
BEGIN
  UPDATE public.conversation_participants
  SET last_read_at = now(), last_delivered_at = now()
  WHERE user_id = p_user_id
    AND (last_read_at IS NULL OR last_read_at < now());

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_conversations_read FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_all_conversations_read TO authenticated, service_role;

-- Include admin_user_id in participant checks + sync
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
        OR c.admin_user_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.conversation_participants cp
          WHERE cp.conversation_id = c.id
            AND cp.user_id = p_user_id
            AND cp.deleted_at IS NULL
        )
      )
  );
$$;

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

  IF NEW.admin_user_id IS NOT NULL THEN
    INSERT INTO public.conversation_participants (conversation_id, user_id, role)
    VALUES (NEW.id, NEW.admin_user_id, 'admin')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Allow messaging on scoped chats (project/package/emergency/admin/support)
-- even when no service_request unlock status applies.
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
          OR coalesce(c.chat_scope, 'request') IN (
            'project', 'package', 'emergency', 'admin', 'support'
          )
          OR sr.status IN (
            'accepted', 'quoted', 'quote_accepted', 'quote_declined',
            'in_progress', 'completed_by_business', 'completed'
          )
        )
    )
  );
