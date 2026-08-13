-- Sprint 5 Phase 2 — File Sharing & Media Collaboration

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
      'chat_emergency_response',
      -- Sprint 5 Phase 2
      'media_file_uploaded',
      'media_file_viewed',
      'media_file_downloaded',
      'media_preview_opened',
      'media_voice_played',
      'media_gallery_viewed',
      'media_project_shared',
      'media_file_renamed',
      'media_file_deleted',
      'media_file_restored',
      'media_file_replaced',
      'media_file_pinned',
      'media_processing_queued',
      'media_processing_completed'
    )
  );

-- ---------------------------------------------------------------------------
-- message_attachments enrichment
-- ---------------------------------------------------------------------------
ALTER TABLE public.message_attachments
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pinned_by UUID,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (processing_status IN (
      'pending', 'queued', 'processing', 'ready', 'failed', 'skipped'
    )),
  ADD COLUMN IF NOT EXISTS ocr_ready BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS restore_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replaced_attachment_id UUID,
  ADD COLUMN IF NOT EXISTS forwarded_from_attachment_id UUID,
  ADD COLUMN IF NOT EXISTS media_object_id UUID;

UPDATE public.message_attachments
SET display_name = file_name
WHERE display_name IS NULL AND file_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS message_attachments_pinned_idx
  ON public.message_attachments (conversation_id, pinned_at DESC)
  WHERE is_pinned = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS message_attachments_restore_idx
  ON public.message_attachments (restore_until)
  WHERE deleted_at IS NOT NULL AND restore_until IS NOT NULL;

-- ---------------------------------------------------------------------------
-- project_documents enrichment + gallery categories
-- ---------------------------------------------------------------------------
ALTER TABLE public.project_documents
  DROP CONSTRAINT IF EXISTS project_documents_kind_check;

ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS bucket TEXT NOT NULL DEFAULT 'project-media',
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS width INT,
  ADD COLUMN IF NOT EXISTS height INT,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS thumbnail_path TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS gallery_category TEXT NOT NULL DEFAULT 'progress'
    CHECK (gallery_category IN (
      'before', 'progress', 'completed', 'documents', 'invoices', 'certificates', 'other'
    )),
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'ready'
    CHECK (processing_status IN (
      'pending', 'queued', 'processing', 'ready', 'failed', 'skipped'
    )),
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restore_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_object_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_kind_check'
  ) THEN
    ALTER TABLE public.project_documents
      ADD CONSTRAINT project_documents_kind_check
      CHECK (kind IN (
        'photo', 'document', 'receipt', 'other',
        'video', 'audio', 'invoice', 'certificate'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS project_documents_gallery_idx
  ON public.project_documents (project_id, gallery_category, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS project_documents_package_idx
  ON public.project_documents (package_id, created_at DESC)
  WHERE package_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- media_objects — AI-ready registry + storage accounting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  display_name TEXT,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'other'
    CHECK (kind IN ('image', 'document', 'voice', 'video', 'other', 'audio')),
  width INT,
  height INT,
  duration_ms INTEGER,
  thumbnail_path TEXT,
  conversation_id UUID,
  project_id UUID,
  package_id UUID,
  message_attachment_id UUID,
  project_document_id UUID,
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN (
      'pending', 'queued', 'processing', 'ready', 'failed', 'skipped'
    )),
  ocr_ready BOOLEAN NOT NULL DEFAULT false,
  analysis_ready BOOLEAN NOT NULL DEFAULT false,
  transcription_ready BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMPTZ,
  restore_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);

CREATE INDEX IF NOT EXISTS media_objects_owner_idx
  ON public.media_objects (owner_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS media_objects_conversation_idx
  ON public.media_objects (conversation_id)
  WHERE conversation_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS media_objects_project_idx
  ON public.media_objects (project_id, created_at DESC)
  WHERE project_id IS NOT NULL AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- media_processing_jobs — OCR / vision / transcription queues
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_object_id UUID NOT NULL REFERENCES public.media_objects(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL
    CHECK (job_type IN (
      'thumbnail', 'metadata', 'ocr_prep', 'image_analysis', 'transcription', 'waveform'
    )),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS media_processing_jobs_queue_idx
  ON public.media_processing_jobs (status, created_at ASC)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS media_processing_jobs_media_idx
  ON public.media_processing_jobs (media_object_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- user_storage_usage — aggregated quotas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_storage_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bytes_used BIGINT NOT NULL DEFAULT 0,
  file_count INT NOT NULL DEFAULT 0,
  deleted_bytes BIGINT NOT NULL DEFAULT 0,
  deleted_file_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.recompute_user_storage_usage(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_storage_usage (user_id, bytes_used, file_count, deleted_bytes, deleted_file_count, updated_at)
  SELECT
    p_user_id,
    COALESCE(SUM(size_bytes) FILTER (WHERE deleted_at IS NULL), 0),
    COALESCE(COUNT(*) FILTER (WHERE deleted_at IS NULL), 0)::INT,
    COALESCE(SUM(size_bytes) FILTER (WHERE deleted_at IS NOT NULL), 0),
    COALESCE(COUNT(*) FILTER (WHERE deleted_at IS NOT NULL), 0)::INT,
    now()
  FROM public.media_objects
  WHERE owner_user_id = p_user_id
  ON CONFLICT (user_id) DO UPDATE
    SET bytes_used = EXCLUDED.bytes_used,
        file_count = EXCLUDED.file_count,
        deleted_bytes = EXCLUDED.deleted_bytes,
        deleted_file_count = EXCLUDED.deleted_file_count,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_media_objects_storage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_user_storage_usage(OLD.owner_user_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_user_storage_usage(NEW.owner_user_id);
  IF TG_OP = 'UPDATE' AND OLD.owner_user_id IS DISTINCT FROM NEW.owner_user_id THEN
    PERFORM public.recompute_user_storage_usage(OLD.owner_user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_objects_storage ON public.media_objects;
CREATE TRIGGER trg_media_objects_storage
  AFTER INSERT OR UPDATE OR DELETE ON public.media_objects
  FOR EACH ROW EXECUTE FUNCTION public.trg_media_objects_storage();

-- Soft-delete with restore window (default 7 days)
CREATE OR REPLACE FUNCTION public.soft_delete_media_object(
  p_media_id UUID,
  p_user_id UUID,
  p_restore_days INT DEFAULT 7
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.media_objects
  SET deleted_at = now(),
      restore_until = now() + make_interval(days => GREATEST(1, LEAST(p_restore_days, 30))),
      updated_at = now()
  WHERE id = p_media_id
    AND owner_user_id = p_user_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.message_attachments
  SET deleted_at = now(),
      restore_until = now() + make_interval(days => GREATEST(1, LEAST(p_restore_days, 30)))
  WHERE media_object_id = p_media_id AND deleted_at IS NULL;

  UPDATE public.project_documents
  SET deleted_at = now(),
      restore_until = now() + make_interval(days => GREATEST(1, LEAST(p_restore_days, 30)))
  WHERE media_object_id = p_media_id AND deleted_at IS NULL;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_media_object(
  p_media_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.media_objects
  SET deleted_at = NULL,
      restore_until = NULL,
      updated_at = now()
  WHERE id = p_media_id
    AND owner_user_id = p_user_id
    AND deleted_at IS NOT NULL
    AND (restore_until IS NULL OR restore_until > now());

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.message_attachments
  SET deleted_at = NULL, restore_until = NULL
  WHERE media_object_id = p_media_id;

  UPDATE public.project_documents
  SET deleted_at = NULL, restore_until = NULL
  WHERE media_object_id = p_media_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_media_object FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_media_object FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recompute_user_storage_usage FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_media_object TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_media_object TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_user_storage_usage TO service_role;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  false,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = false;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-media',
  'project-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = false;

-- Project media storage policies: path {userId}/{projectId}/...
DROP POLICY IF EXISTS project_media_insert ON storage.objects;
CREATE POLICY project_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS project_media_select ON storage.objects;
CREATE POLICY project_media_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role('admin')
      OR EXISTS (
        SELECT 1
        FROM public.service_projects sp
        WHERE sp.id::text = (storage.foldername(name))[2]
          AND (
            sp.customer_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.project_packages pp
              JOIN public.providers pr ON pr.id = pp.assigned_provider_id
              WHERE pp.project_id = sp.id AND pr.owner_id = auth.uid()
            )
          )
      )
    )
  );

DROP POLICY IF EXISTS project_media_delete ON storage.objects;
CREATE POLICY project_media_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- RLS for new tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.media_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_storage_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_objects_owner_select ON public.media_objects;
CREATE POLICY media_objects_owner_select ON public.media_objects
  FOR SELECT TO authenticated
  USING (
    owner_user_id = auth.uid()
    OR public.has_role('admin')
    OR (
      conversation_id IS NOT NULL
      AND public.is_conversation_participant(conversation_id, auth.uid())
    )
    OR (
      project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.service_projects sp
        WHERE sp.id = project_id AND sp.customer_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS media_objects_owner_insert ON public.media_objects;
CREATE POLICY media_objects_owner_insert ON public.media_objects
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS media_objects_owner_update ON public.media_objects;
CREATE POLICY media_objects_owner_update ON public.media_objects
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role('admin'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role('admin'));

DROP POLICY IF EXISTS media_jobs_select ON public.media_processing_jobs;
CREATE POLICY media_jobs_select ON public.media_processing_jobs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.media_objects m
      WHERE m.id = media_object_id
        AND (
          m.owner_user_id = auth.uid()
          OR public.has_role('admin')
        )
    )
  );

DROP POLICY IF EXISTS user_storage_usage_self ON public.user_storage_usage;
CREATE POLICY user_storage_usage_self ON public.user_storage_usage
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role('admin'));

-- Project document write for customer (+ soft participant later via actions)
DROP POLICY IF EXISTS project_documents_customer_insert ON public.project_documents;
CREATE POLICY project_documents_customer_insert
  ON public.project_documents FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_projects p
      WHERE p.id = project_id AND p.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS project_documents_customer_update ON public.project_documents;
CREATE POLICY project_documents_customer_update
  ON public.project_documents FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_projects p
      WHERE p.id = project_id AND p.customer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_projects p
      WHERE p.id = project_id AND p.customer_id = auth.uid()
    )
  );

-- Link FKs (nullable soft links)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_attachments_media_object_fkey'
  ) THEN
    ALTER TABLE public.message_attachments
      ADD CONSTRAINT message_attachments_media_object_fkey
      FOREIGN KEY (media_object_id) REFERENCES public.media_objects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_media_object_fkey'
  ) THEN
    ALTER TABLE public.project_documents
      ADD CONSTRAINT project_documents_media_object_fkey
      FOREIGN KEY (media_object_id) REFERENCES public.media_objects(id) ON DELETE SET NULL;
  END IF;
END $$;
