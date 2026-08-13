-- Generic "contact platform support" channel — a provider or customer can
-- send a message that reaches the admin support inbox (/admin/support),
-- separate from booking_issue_reports (which requires an actual booking).

CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "admin_note" "text",
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "support_messages_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"]))),
    CONSTRAINT "support_messages_role_check" CHECK (("role" = ANY (ARRAY['customer'::"text", 'business'::"text"])))
);

ALTER TABLE "public"."support_messages" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "support_messages_user_id_idx" ON "public"."support_messages" ("user_id");
CREATE INDEX IF NOT EXISTS "support_messages_status_created_idx" ON "public"."support_messages" ("status", "created_at" DESC);

ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_messages_insert" ON "public"."support_messages"
  FOR INSERT TO "authenticated"
  WITH CHECK ("user_id" = "auth"."uid"());

CREATE POLICY "support_messages_select" ON "public"."support_messages"
  FOR SELECT TO "authenticated"
  USING (
    ("user_id" = "auth"."uid"())
    OR "public"."has_role"('admin'::"public"."app_role")
    OR "public"."has_role"('moderator'::"public"."app_role")
  );

CREATE POLICY "support_messages_admin_update" ON "public"."support_messages"
  FOR UPDATE TO "authenticated"
  USING (
    "public"."has_role"('admin'::"public"."app_role")
    OR "public"."has_role"('moderator'::"public"."app_role")
  )
  WITH CHECK (true);
