-- Sprint 5.5 — Stabilization: RLS hardening, indexes, attachment updates

-- Checklist items FK lookup
CREATE INDEX IF NOT EXISTS project_checklist_items_checklist_idx
  ON public.project_checklist_items (checklist_id);

-- Activity / approvals / tasks common filters
CREATE INDEX IF NOT EXISTS project_approvals_pending_idx
  ON public.project_approvals (project_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS smart_notifications_unread_idx
  ON public.smart_notifications (user_id, created_at DESC)
  WHERE status = 'unread' AND deleted_at IS NULL AND is_group_summary = false;

-- message_attachments: allow participant updates (pin/rename/soft fields)
DROP POLICY IF EXISTS message_attachments_participant_update ON public.message_attachments;
CREATE POLICY message_attachments_participant_update ON public.message_attachments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_attachments.conversation_id
        AND (
          c.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = c.provider_id AND p.owner_id = auth.uid()
          )
          OR c.admin_user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = message_attachments.conversation_id
        AND (
          c.customer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.providers p
            WHERE p.id = c.provider_id AND p.owner_id = auth.uid()
          )
          OR c.admin_user_id = auth.uid()
        )
    )
  );

-- Approvals: members can SELECT; only project customer may decide (UPDATE status)
DROP POLICY IF EXISTS project_approvals_member_all ON public.project_approvals;

DROP POLICY IF EXISTS project_approvals_member_select ON public.project_approvals;
CREATE POLICY project_approvals_member_select ON public.project_approvals
  FOR SELECT TO authenticated
  USING (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS project_approvals_member_insert ON public.project_approvals;
CREATE POLICY project_approvals_member_insert ON public.project_approvals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_project_member(project_id, auth.uid()));

DROP POLICY IF EXISTS project_approvals_customer_decide ON public.project_approvals;
CREATE POLICY project_approvals_customer_decide ON public.project_approvals
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.service_projects sp
      WHERE sp.id = project_id AND sp.customer_id = auth.uid()
    )
    OR public.has_role('admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_projects sp
      WHERE sp.id = project_id AND sp.customer_id = auth.uid()
    )
    OR public.has_role('admin')
  );

COMMENT ON POLICY project_approvals_customer_decide ON public.project_approvals IS
  'Sprint 5.5 — only project customer (or admin) may approve/reject.';
